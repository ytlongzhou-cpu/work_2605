/**
 * 模块K：WebSocket 实时同步 - Socket.io 事件注册入口
 *
 * 职责：
 *   1. 连接时验证 JWT Token，失败则拒绝连接
 *   2. 维护房间（sheetId 为房间 ID），广播 user:joined / user:left
 *   3. 处理 cell:update 事件：持久化到数据库 + 广播 cell:updated
 *   4. 处理 cursor:move 事件：更新 edit_sessions 表 + 广播 cursor:moved
 *   5. 断线时清理 edit_sessions，广播 user:left
 *
 * 挂载方式（在 backend/app.js 中）：
 *   const { createServer } = require('http');
 *   const { Server } = require('socket.io');
 *   const { initSocketHandler } = require('./modules/collaboration/socketHandler');
 *   const httpServer = createServer(app);
 *   const io = new Server(httpServer, { cors: { origin: '*' } });
 *   initSocketHandler(io);
 *   httpServer.listen(3000);
 *
 * 依赖：
 *   - jwtHelper        来自模块G：backend/modules/auth/jwtHelper.js
 *   - upsertCellsCore  来自模块J（见《模块J补丁说明》文档）
 *   - roomManager      本模块
 *   - colorAssigner    本模块
 *   - getPool / sql    来自 backend/db.js
 */

'use strict';

const { verifyToken }     = require('../auth/jwtHelper');
const {
  upsertCellsCore,
  upsertStyleCore,
} = require('../cells/cellsController');
const roomManager         = require('./roomManager');
const colorAssigner       = require('./colorAssigner');
const { getPool, sql }    = require('../../db');

// ─────────────────────────────────────────────
// 工具：更新 edit_sessions 表（光标持久化）
// ─────────────────────────────────────────────

/**
 * 在 edit_sessions 表中 upsert 用户的当前光标位置
 * @param {number} userId
 * @param {number} sheetId
 * @param {number} row
 * @param {number} col
 */
async function upsertEditSession(userId, sheetId, row, col) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId',  sql.Int, userId)
    .input('sheetId', sql.Int, sheetId)
    .input('row',     sql.Int, row)
    .input('col',     sql.Int, col)
    .query(`
      MERGE edit_sessions AS target
      USING (VALUES (@userId, @sheetId, @row, @col))
            AS source(user_id, sheet_id, row_index, col_index)
      ON    target.user_id  = source.user_id
        AND target.sheet_id = source.sheet_id
      WHEN MATCHED THEN
        UPDATE SET
          row_index  = source.row_index,
          col_index  = source.col_index,
          updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (user_id, sheet_id, row_index, col_index)
        VALUES (source.user_id, source.sheet_id,
                source.row_index, source.col_index);
    `);
}

/**
 * 删除用户在指定 Sheet 的 edit_sessions 记录
 * @param {number} userId
 * @param {number} sheetId
 */
async function deleteEditSession(userId, sheetId) {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('userId',  sql.Int, userId)
      .input('sheetId', sql.Int, sheetId)
      .query(`
        DELETE FROM edit_sessions
        WHERE user_id = @userId AND sheet_id = @sheetId
      `);
  } catch (err) {
    // 断线清理失败不影响主流程，只记录日志
    console.error('[socketHandler] deleteEditSession error:', err);
  }
}

// ─────────────────────────────────────────────
// 主入口：初始化 Socket.io 事件监听
// ─────────────────────────────────────────────

/**
 * 初始化 Socket.io 服务端事件处理
 * @param {import('socket.io').Server} io
 */
function initSocketHandler(io) {

  // ── 全局认证中间件：连接时验证 JWT ──
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('未提供认证 Token'));
    }

    // BUG FIX：verifyToken 在 token 无效时会抛出异常，需 try/catch
    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      return next(new Error('Token 无效或已过期'));
    }

    if (!payload) {
      return next(new Error('Token 无效或已过期'));
    }

    socket.user = {
      id:          payload.id,
      username:    payload.username,
      displayName: payload.display_name,
      role:        payload.role,
    };
    next();
  });

  // ── 全局在线用户表（userId → userInfo），用于大厅广播 ──
  // BUG FIX：改用 userId 为 key（而非 socketId），避免同一用户刷新/重连后
  // 在全局在线列表中出现重复条目，导致"X 人在线"计数偏高。
  const globalOnline = new Map(); // userId → { userId, displayName, color, socketId }

  /** 广播最新的全局在线用户列表给所有连接的客户端 */
  function broadcastGlobalUsers() {
    const list = Array.from(globalOnline.values()).map(({ userId, displayName, color }) => ({ userId, displayName, color }));
    io.emit('global:users', list);
  }

  // ── 连接建立 ──
  io.on('connection', (socket) => {
    const { user } = socket;
    console.log(`[socketHandler] 用户连接: ${user.displayName}(${user.id}) socket=${socket.id}`);

    // 为用户分配颜色（全局唯一，跨房间保持一致）
    const color = colorAssigner.assignColor(user.id);

    // 加入全局在线列表并广播给所有人
    globalOnline.set(user.id, { userId: user.id, displayName: user.displayName, color: color.cursor, socketId: socket.id });
    // 同时单独推给自己，确保自己也能立刻看到最新在线列表（避免竞态）
    const globalList = Array.from(globalOnline.values()).map(({ userId, displayName, color: c }) => ({ userId, displayName, color: c }));
    socket.emit('global:users', globalList);
    broadcastGlobalUsers();

    // ── room:join 进入 Sheet 房间 ──
    socket.on('room:join', async ({ sheetId }) => {
      if (!sheetId || typeof sheetId !== 'number') return;

      const roomId = String(sheetId);
      socket.join(roomId);

      // 注册到内存房间状态
      roomManager.joinRoom(sheetId, user.id, user.displayName, color.cursor, socket.id);

      // 初始化光标到 edit_sessions
      try {
        await upsertEditSession(user.id, sheetId, 0, 0);
      } catch (err) {
        console.error('[socketHandler] upsertEditSession on join error:', err);
      }

      // 向新加入用户推送当前房间在线用户列表
      const currentUsers = roomManager.getRoomUsers(sheetId);
      socket.emit('room:users', currentUsers);

      // 向房间其他用户广播有人加入
      socket.to(roomId).emit('user:joined', {
        userId:      user.id,
        displayName: user.displayName,
        color:       color.cursor,
      });

      console.log(`[socketHandler] ${user.displayName} 加入房间 sheetId=${sheetId}`);
    });

    // ── room:leave 离开 Sheet 房间 ──
    socket.on('room:leave', async ({ sheetId }) => {
      if (!sheetId || typeof sheetId !== 'number') return;
      await _handleLeaveRoom(io, socket, sheetId, user);
    });

    // ── cell:update 用户修改单元格 ──
    socket.on('cell:update', async (payload) => {
      const sheetId = Number(payload?.sheetId);
      const row     = Number(payload?.row);
      const col     = Number(payload?.col);
      const value   = payload?.value ?? null;

      if (!Number.isFinite(sheetId) || !Number.isFinite(row) || !Number.isFinite(col)) {
        socket.emit('error', { message: '参数错误', code: 400 });
        return;
      }

      // BUG FIX：先立即广播给房间内其他用户（不等 DB 写入），减少同步延迟
      // 即使 DB 写入失败，远端用户也能实时看到变更（重载时会从 DB 恢复正确值）
      socket.to(String(sheetId)).emit('cell:updated', {
        userId:      user.id,
        displayName: user.displayName,
        sheetId,
        row,
        col,
        value,
      });

      // 异步持久化到数据库（不阻塞广播）
      upsertCellsCore(sheetId, [{ row, col, value }], user.id).catch((err) => {
        console.error('[socketHandler] cell:update upsertCellsCore error:', err);
      });
    });

    // ── style:update 用户修改单元格样式 ──
    socket.on('style:update', async (payload) => {
      const sheetId = Number(payload?.sheetId);
      const cells   = payload?.cells;
      if (!Number.isFinite(sheetId) || !Array.isArray(cells) || cells.length === 0) {
        socket.emit('error', { message: '参数错误', code: 400 });
        return;
      }

      // BUG FIX：先立即广播样式变更给房间内其他用户，再异步持久化
      socket.to(String(sheetId)).emit('style:updated', {
        userId:  user.id,
        sheetId,
        cells,
      });

      // 异步持久化样式到数据库（不阻塞广播）
      const styleCells = cells.map(c => ({
        row:   c.row,
        col:   c.col,
        value: undefined,
        style: c.style,
      }));
      upsertStyleCore(sheetId, styleCells, user.id).catch((err) => {
        console.error('[socketHandler] style:update upsertStyleCore error:', err);
      });
    });

    // ── row:delete 用户删除行 ──
    socket.on('row:delete', async (payload) => {
      const sheetId = Number(payload?.sheetId);
      const index   = Number(payload?.index);
      const amount  = Number(payload?.amount) || 1;

      if (!Number.isFinite(sheetId) || !Number.isFinite(index) || index < 0) {
        socket.emit('error', { message: '参数错误', code: 400 });
        return;
      }

      // 先广播给其他用户，减少同步延迟
      socket.to(String(sheetId)).emit('row:deleted', {
        userId: user.id,
        sheetId,
        index,
        amount,
      });

      // 持久化由发起端的 HTTP 接口负责；socket 只广播，避免同一次结构变更写库两次。
    });

    // ── col:delete 用户删除列 ──
    socket.on('col:delete', async (payload) => {
      const sheetId = Number(payload?.sheetId);
      const index   = Number(payload?.index);
      const amount  = Number(payload?.amount) || 1;

      if (!Number.isFinite(sheetId) || !Number.isFinite(index) || index < 0) {
        socket.emit('error', { message: '参数错误', code: 400 });
        return;
      }

      socket.to(String(sheetId)).emit('col:deleted', {
        userId: user.id,
        sheetId,
        index,
        amount,
      });

      // 持久化由发起端的 HTTP 接口负责；socket 只广播，避免同一次结构变更写库两次。
    });

    // ── row:insert 用户插入行 ──
    socket.on('row:insert', async (payload) => {
      const sheetId = Number(payload?.sheetId);
      const index   = Number(payload?.index);
      const amount  = Number(payload?.amount) || 1;

      if (!Number.isFinite(sheetId) || !Number.isFinite(index) || index < 0) {
        socket.emit('error', { message: '参数错误', code: 400 });
        return;
      }

      socket.to(String(sheetId)).emit('row:inserted', {
        userId: user.id,
        sheetId,
        index,
        amount,
      });

      // 持久化由发起端的 HTTP 接口负责；socket 只广播，避免同一次结构变更写库两次。
    });

    // ── col:insert 用户插入列 ──
    socket.on('col:insert', async (payload) => {
      const sheetId = Number(payload?.sheetId);
      const index   = Number(payload?.index);
      const amount  = Number(payload?.amount) || 1;

      if (!Number.isFinite(sheetId) || !Number.isFinite(index) || index < 0) {
        socket.emit('error', { message: '参数错误', code: 400 });
        return;
      }

      socket.to(String(sheetId)).emit('col:inserted', {
        userId: user.id,
        sheetId,
        index,
        amount,
      });

      // 持久化由发起端的 HTTP 接口负责；socket 只广播，避免同一次结构变更写库两次。
    });

    // ── cursor:move 用户移动光标 ──
    socket.on('cursor:move', async ({ sheetId, row, col }) => {
      if (
        typeof sheetId !== 'number' ||
        typeof row     !== 'number' ||
        typeof col     !== 'number'
      ) return;

      // 更新内存状态
      roomManager.updateCursor(sheetId, user.id, row, col);

      // 异步更新数据库（不阻塞广播）
      upsertEditSession(user.id, sheetId, row, col).catch((err) => {
        console.error('[socketHandler] cursor upsertEditSession error:', err);
      });

      // 广播给房间其他用户
      socket.to(String(sheetId)).emit('cursor:moved', {
        userId:      user.id,
        displayName: user.displayName,
        color:       color.cursor,
        sheetId,
        row,
        col,
      });
    });

    // ── disconnect 断线处理 ──
    socket.on('disconnect', async () => {
      console.log(`[socketHandler] 用户断线: ${user.displayName}(${user.id}) socket=${socket.id}`);

      // 从全局在线列表移除并广播
      globalOnline.delete(user.id);
      broadcastGlobalUsers();

      // 通过反向索引找到用户所在房间，统一清理
      const location = roomManager.findBySocket(socket.id);
      if (location) {
        await _handleLeaveRoom(io, socket, location.sheetId, user);
      }

      // 释放颜色槽位
      colorAssigner.releaseColor(user.id);
    });
  });
}

// ─────────────────────────────────────────────
// 内部：统一处理离开房间逻辑（room:leave 和 disconnect 共用）
// ─────────────────────────────────────────────

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {number} sheetId
 * @param {{ id: number, displayName: string }} user
 */
async function _handleLeaveRoom(io, socket, sheetId, user) {
  const roomId = String(sheetId);

  socket.leave(roomId);
  roomManager.leaveRoom(sheetId, user.id, socket.id);

  // 清理数据库中的光标记录
  await deleteEditSession(user.id, sheetId);

  // 向房间剩余用户广播有人离开
  io.to(roomId).emit('user:left', {
    userId:      user.id,
    displayName: user.displayName,
  });

  console.log(`[socketHandler] ${user.displayName} 离开房间 sheetId=${sheetId}`);
}

module.exports = { initSocketHandler };
