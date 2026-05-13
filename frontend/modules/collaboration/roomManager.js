/**
 * 模块K：WebSocket 实时同步 - 房间与在线用户状态管理
 *
 * 以 sheetId 为房间 ID，维护每个房间内在线用户的状态（包含光标位置）。
 * 所有状态保存在内存中，服务重启后清空（符合文档设计：edit_sessions 表
 * 负责持久化，内存状态仅用于实时广播）。
 */

'use strict';

/**
 * 房间状态结构：
 *   rooms: Map<sheetId, Map<userId, UserState>>
 *
 * UserState:
 *   { userId, displayName, color, socketId, row, col }
 */
const rooms = new Map();

/**
 * socketId → { userId, sheetId } 的反向索引
 * 用于断线时快速定位用户所在房间
 * @type {Map<string, { userId: number, sheetId: number }>}
 */
const socketIndex = new Map();

// ─── 房间操作 ───────────────────────────────────

/**
 * 用户加入房间
 * @param {number} sheetId
 * @param {number} userId
 * @param {string} displayName
 * @param {string} color       - 由 colorAssigner 分配的光标颜色
 * @param {string} socketId
 */
function joinRoom(sheetId, userId, displayName, color, socketId) {
  if (!rooms.has(sheetId)) {
    rooms.set(sheetId, new Map());
  }
  rooms.get(sheetId).set(userId, {
    userId,
    displayName,
    color,
    socketId,
    row: 0,
    col: 0,
  });
  socketIndex.set(socketId, { userId, sheetId });
}

/**
 * 用户离开房间
 * @param {number} sheetId
 * @param {number} userId
 * @param {string} socketId
 */
function leaveRoom(sheetId, userId, socketId) {
  if (rooms.has(sheetId)) {
    rooms.get(sheetId).delete(userId);
    if (rooms.get(sheetId).size === 0) {
      rooms.delete(sheetId); // 房间空了则销毁
    }
  }
  socketIndex.delete(socketId);
}

/**
 * 根据 socketId 查找用户所在房间信息（用于断线处理）
 * @param {string} socketId
 * @returns {{ userId: number, sheetId: number } | null}
 */
function findBySocket(socketId) {
  return socketIndex.get(socketId) || null;
}

/**
 * 更新用户光标位置
 * @param {number} sheetId
 * @param {number} userId
 * @param {number} row
 * @param {number} col
 */
function updateCursor(sheetId, userId, row, col) {
  if (rooms.has(sheetId) && rooms.get(sheetId).has(userId)) {
    const user = rooms.get(sheetId).get(userId);
    user.row = row;
    user.col = col;
  }
}

/**
 * 获取房间内所有在线用户列表
 * @param {number} sheetId
 * @returns {Array<{ userId, displayName, color, row, col }>}
 */
function getRoomUsers(sheetId) {
  if (!rooms.has(sheetId)) return [];
  return Array.from(rooms.get(sheetId).values()).map((u) => ({
    userId:      u.userId,
    displayName: u.displayName,
    color:       u.color,
    row:         u.row,
    col:         u.col,
  }));
}

/**
 * 获取指定用户在指定房间的状态
 * @param {number} sheetId
 * @param {number} userId
 * @returns {{ userId, displayName, color, row, col } | null}
 */
function getUserInRoom(sheetId, userId) {
  if (!rooms.has(sheetId)) return null;
  return rooms.get(sheetId).get(userId) || null;
}

module.exports = {
  joinRoom,
  leaveRoom,
  findBySocket,
  updateCursor,
  getRoomUsers,
  getUserInRoom,
};
