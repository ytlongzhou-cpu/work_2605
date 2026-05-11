/**
 * 模块E：前端实时协作层 - WebSocket 管理 Hook（核心）
 *
 * 职责：
 *   - 建立/断开 Socket.io 连接，Token 认证
 *   - 进入/离开 Sheet 房间（sheetId 变化时自动切换）
 *   - 监听 cell:updated → 调用 onRemoteCellChange 通知模块D
 *   - 监听 cursor:moved → 维护 otherCursors 状态供模块D渲染
 *   - 监听 user:joined / user:left → 维护 onlineUsers 供模块B
 *   - 断线自动重连后重新加入当前房间
 *   - 提供 broadcastCellChange / broadcastCursorMove 给模块D调用
 *
 * 对外暴露接口（第六章 E.3 节）：
 *   const {
 *     onlineUsers,          // [{ userId, displayName, color }]
 *     otherCursors,         // [{ userId, displayName, color, row, col }]
 *     broadcastCellChange,  // (row, col, value) => void
 *     broadcastCursorMove,  // (row, col) => void
 *   } = useCollaboration(sheetId);
 *
 * Props 说明：
 *   sheetId          {number|null} 当前打开的 Sheet ID，null 表示未打开任何 Sheet
 *   onRemoteCellChange {Function}  (row, col, value) => void，收到远端更新时调用
 *
 * 依赖：
 *   - useAuth()  来自模块A：src/modules/auth/AuthContext.jsx
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { connectSocket, disconnectSocket, getSocket } from './socketClient';

/**
 * WebSocket 管理 Hook
 * @param {number|null} sheetId            - 当前 Sheet ID
 * @param {Function}    onRemoteCellChange  - 远端单元格变更回调 (row, col, value) => void
 * @returns {{
 *   onlineUsers: Array,
 *   otherCursors: Array,
 *   broadcastCellChange: Function,
 *   broadcastCursorMove: Function,
 * }}
 */
export function useCollaboration(sheetId, onRemoteCellChange) {
  const { user, token } = useAuth();

  /** 当前房间在线用户列表（含自己） */
  const [onlineUsers, setOnlineUsers] = useState([]);

  /**
   * 其他用户的光标位置列表（不含自己）
   * [{ userId, displayName, color, row, col }]
   */
  const [otherCursors, setOtherCursors] = useState([]);

  /**
   * 用 ref 保存 sheetId，供事件回调闭包中使用（避免 stale closure）
   */
  const sheetIdRef = useRef(sheetId);
  sheetIdRef.current = sheetId;

  /** onRemoteCellChange 也用 ref 保存，避免 useEffect 频繁重新绑定 */
  const onRemoteCellChangeRef = useRef(onRemoteCellChange);
  onRemoteCellChangeRef.current = onRemoteCellChange;

  // ── 建立连接 & 绑定事件 ──────────────────────────────────────────────
  useEffect(() => {
    if (!token || !user) return;

    const socket = connectSocket(token);

    // ── 连接成功（含重连后）：重新加入当前房间 ──
    const handleConnect = () => {
      console.log('[useCollaboration] Socket 已连接，重新加入房间');
      if (sheetIdRef.current) {
        socket.emit('room:join', { sheetId: sheetIdRef.current });
      }
    };

    // ── 收到房间当前在线用户列表（加入房间时服务端推送） ──
    const handleRoomUsers = (users) => {
      setOnlineUsers(users);
      // otherCursors 初始化为有坐标的其他用户
      setOtherCursors(
        users
          .filter((u) => u.userId !== user.id)
          .map((u) => ({
            userId:      u.userId,
            displayName: u.displayName,
            color:       u.color,
            row:         u.row,
            col:         u.col,
          }))
      );
    };

    // ── 有人加入房间 ──
    const handleUserJoined = ({ userId, displayName, color }) => {
      setOnlineUsers((prev) => {
        // 防止重复
        if (prev.find((u) => u.userId === userId)) return prev;
        return [...prev, { userId, displayName, color }];
      });
    };

    // ── 有人离开房间 ──
    const handleUserLeft = ({ userId }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== userId));
      setOtherCursors((prev) => prev.filter((u) => u.userId !== userId));
    };

    // ── 收到远端单元格变更 ──
    const handleCellUpdated = ({ userId: senderId, sheetId: sid, row, col, value }) => {
      // 只处理当前 Sheet 的消息
      if (sid !== sheetIdRef.current) return;
      // 自己发出的消息服务端不回发，此处可做二次防御
      if (senderId === user.id) return;
      onRemoteCellChangeRef.current?.(row, col, value);
    };

    // ── 收到远端光标移动 ──
    const handleCursorMoved = ({ userId: senderId, displayName, color, sheetId: sid, row, col }) => {
      if (sid !== sheetIdRef.current) return;
      if (senderId === user.id) return;

      setOtherCursors((prev) => {
        const filtered = prev.filter((u) => u.userId !== senderId);
        return [...filtered, { userId: senderId, displayName, color, row, col }];
      });
    };

    // ── 绑定所有事件 ──
    socket.on('connect',       handleConnect);
    socket.on('room:users',    handleRoomUsers);
    socket.on('user:joined',   handleUserJoined);
    socket.on('user:left',     handleUserLeft);
    socket.on('cell:updated',  handleCellUpdated);
    socket.on('cursor:moved',  handleCursorMoved);

    // 如果 socket 已经是连接状态（如 token 变化后重新执行 effect），
    // 直接触发一次 join
    if (socket.connected && sheetIdRef.current) {
      socket.emit('room:join', { sheetId: sheetIdRef.current });
    }

    // ── 清理：组件卸载时解绑事件，不断开连接（连接由登出统一管理） ──
    return () => {
      socket.off('connect',      handleConnect);
      socket.off('room:users',   handleRoomUsers);
      socket.off('user:joined',  handleUserJoined);
      socket.off('user:left',    handleUserLeft);
      socket.off('cell:updated', handleCellUpdated);
      socket.off('cursor:moved', handleCursorMoved);
    };
  }, [token, user]);

  // ── 切换 Sheet 时自动离开旧房间、加入新房间 ──────────────────────────
  const prevSheetIdRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const prev = prevSheetIdRef.current;
    const next = sheetId;

    if (prev && prev !== next) {
      socket.emit('room:leave', { sheetId: prev });
    }

    if (next) {
      socket.emit('room:join', { sheetId: next });
      setOnlineUsers([]);
      setOtherCursors([]);
    }

    prevSheetIdRef.current = next;
  }, [sheetId]);

  // ── 登出时断开 Socket ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setOnlineUsers([]);
      setOtherCursors([]);
    }
  }, [token]);

  // ── 对外广播函数 ─────────────────────────────────────────────────────

  /**
   * 广播本地单元格变更给其他用户（同时由模块D调用后端 PUT 接口保存）
   * @param {number} row
   * @param {number} col
   * @param {string} value
   */
  const broadcastCellChange = useCallback((row, col, value) => {
    const socket = getSocket();
    if (!socket || !socket.connected || !sheetIdRef.current) return;
    socket.emit('cell:update', { sheetId: sheetIdRef.current, row, col, value });
  }, []);

  /**
   * 广播本地光标移动给其他用户
   * @param {number} row
   * @param {number} col
   */
  const broadcastCursorMove = useCallback((row, col) => {
    const socket = getSocket();
    if (!socket || !socket.connected || !sheetIdRef.current) return;
    socket.emit('cursor:move', { sheetId: sheetIdRef.current, row, col });
  }, []);

  return {
    onlineUsers,
    otherCursors,
    broadcastCellChange,
    broadcastCursorMove,
  };
}
