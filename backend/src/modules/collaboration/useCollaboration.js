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
export function useCollaboration(sheetId, onRemoteCellChange, externalSheetIdRef) {
  const { user, token } = useAuth();

  /** 当前房间在线用户列表（含自己） */
  const [onlineUsers, setOnlineUsers] = useState([]);

  /** 全局在线用户列表（所有已连接用户，无论是否在同一 Sheet） */
  const [globalOnlineUsers, setGlobalOnlineUsers] = useState([]);

  /** Socket 连接状态 */
  const [socketConnected, setSocketConnected] = useState(false);

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

  /** onRemoteStyleChange 回调 ref，由 CollabContext 注入 */
  const onRemoteStyleChangeRef = useRef(null);

  // ── 建立连接 & 绑定事件 ──────────────────────────────────────────────
  useEffect(() => {
    if (!token || !user) return;

    const socket = connectSocket(token);

    // ── 连接成功（含重连后）：重新加入当前房间 ──
    const handleConnect = () => {
      console.log('[useCollaboration] Socket 已连接，重新加入房间');
      setSocketConnected(true);
      if (sheetIdRef.current) {
        socket.emit('room:join', { sheetId: sheetIdRef.current });
      }
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
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

    // 统一读取当前 sheetId（优先外部同步 ref，避免 React state 异步延迟）
    const getCurrentSid = () => externalSheetIdRef?.current ?? sheetIdRef.current;

    // ── 收到远端单元格变更 ──
    const handleCellUpdated = ({ userId: senderId, sheetId: sid, row, col, value }) => {
      if (Number(sid) !== getCurrentSid()) return;
      if (senderId === user.id) return;
      onRemoteCellChangeRef.current?.(row, col, value);
    };

    // ── 收到远端光标移动 ──
    const handleCursorMoved = ({ userId: senderId, displayName, color, sheetId: sid, row, col }) => {
      if (Number(sid) !== getCurrentSid()) return;
      if (senderId === user.id) return;

      setOtherCursors((prev) => {
        const filtered = prev.filter((u) => u.userId !== senderId);
        return [...filtered, { userId: senderId, displayName, color, row, col }];
      });
    };

    // ── 收到全局在线用户列表 ──
    const handleGlobalUsers = (users) => {
      setGlobalOnlineUsers(users);
    };

    // ── 收到远端样式变更 ──
    const handleStyleUpdated = ({ userId: senderId, sheetId: sid, cells }) => {
      if (Number(sid) !== getCurrentSid()) return;
      if (senderId === user.id) return;
      onRemoteStyleChangeRef.current?.(cells);
    };

    // ── 绑定所有事件 ──
    socket.on('connect',        handleConnect);
    socket.on('disconnect',     handleDisconnect);
    socket.on('global:users',   handleGlobalUsers);
    socket.on('room:users',     handleRoomUsers);
    socket.on('user:joined',    handleUserJoined);
    socket.on('user:left',      handleUserLeft);
    socket.on('cell:updated',   handleCellUpdated);
    socket.on('cursor:moved',   handleCursorMoved);
    socket.on('style:updated',  handleStyleUpdated);

    // 如果 socket 已经是连接状态（如 token 变化后重新执行 effect），
    // 直接触发一次 join 并更新连接状态
    if (socket.connected) {
      setSocketConnected(true);
      if (sheetIdRef.current) {
        socket.emit('room:join', { sheetId: sheetIdRef.current });
      }
    }

    // ── 清理：组件卸载时解绑事件，不断开连接（连接由登出统一管理） ──
    return () => {
      socket.off('connect',       handleConnect);
      socket.off('disconnect',    handleDisconnect);
      socket.off('global:users',  handleGlobalUsers);
      socket.off('room:users',    handleRoomUsers);
      socket.off('user:joined',   handleUserJoined);
      socket.off('user:left',     handleUserLeft);
      socket.off('cell:updated',  handleCellUpdated);
      socket.off('cursor:moved',  handleCursorMoved);
      socket.off('style:updated', handleStyleUpdated);
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
      setGlobalOnlineUsers([]);
      setOtherCursors([]);
    }
  }, [token]);

  // ── 对外广播函数 ─────────────────────────────────────────────────────

  /**
   * 广播本地单元格变更给其他用户
   * 直接读 externalSheetIdRef（同步 ref），不依赖 React state，避免异步延迟导致 sheetId 为 null
   */
  const broadcastCellChange = useCallback((row, col, value) => {
    const socket = getSocket();
    // 优先读外部同步 ref，回退到内部 ref
    const sid = externalSheetIdRef?.current ?? sheetIdRef.current;
    if (!socket || !socket.connected || !sid) return;
    socket.emit('cell:update', { sheetId: sid, row, col, value });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 广播本地光标移动给其他用户
   */
  const broadcastCursorMove = useCallback((row, col) => {
    const socket = getSocket();
    const sid = externalSheetIdRef?.current ?? sheetIdRef.current;
    if (!socket || !socket.connected || !sid) return;
    socket.emit('cursor:move', { sheetId: sid, row, col });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 广播本地样式变更给其他用户，并持久化到数据库
   */
  const broadcastStyleChange = useCallback((cells) => {
    const socket = getSocket();
    const sid = externalSheetIdRef?.current ?? sheetIdRef.current;
    if (!socket || !socket.connected || !sid) return;
    socket.emit('style:update', { sheetId: sid, cells });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    onlineUsers,
    globalOnlineUsers,
    socketConnected,
    otherCursors,
    onRemoteStyleChangeRef,
    broadcastCellChange,
    broadcastCursorMove,
    broadcastStyleChange,
  };
}
