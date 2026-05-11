/**
 * 模块E：前端实时协作层 - 协作状态全局 Context
 *
 * BUG FIX：原版 CollabProvider 在 App.jsx 顶层固定接收 sheetId 和
 * onRemoteCellChange props，导致 SpreadsheetEditor 无法动态更新这两个值。
 *
 * 修复方案：
 *   - CollabProvider 只初始化 socket 连接（不再接收 sheetId props）
 *   - 暴露 setCollabSheet(sheetId, onRemoteCellChange) 函数
 *   - SpreadsheetEditor 在 useEffect 里调用 setCollabSheet，动态绑定
 */

import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { useCollaboration } from './useCollaboration';

/** @type {React.Context} */
const CollabContext = createContext(null);

/**
 * 协作状态 Provider
 * sheetId 和 onRemoteCellChange 通过 setCollabSheet 动态注入，
 * 不再需要在 App.jsx 顶层传入。
 */
export function CollabProvider({ children }) {
  const [sheetId, setSheetId] = useState(null);
  const onRemoteCellChangeRef = useRef(null);

  const onRemoteCellChange = useCallback((row, col, value) => {
    onRemoteCellChangeRef.current?.(row, col, value);
  }, []);

  const collab = useCollaboration(sheetId, onRemoteCellChange);

  /**
   * SpreadsheetEditor 调用此函数，绑定当前 Sheet 和远端变更回调
   * @param {number|null} sid
   * @param {Function|null} cb
   */
  const setCollabSheet = useCallback((sid, cb) => {
    setSheetId(sid);
    onRemoteCellChangeRef.current = cb;
  }, []);

  return (
    <CollabContext.Provider value={{ ...collab, setCollabSheet }}>
      {children}
    </CollabContext.Provider>
  );
}

/**
 * 消费协作状态的 Hook
 * @returns {{
 *   onlineUsers: Array,
 *   otherCursors: Array,
 *   broadcastCellChange: Function,
 *   broadcastCursorMove: Function,
 *   setCollabSheet: Function,
 * }}
 */
export function useCollabContext() {
  const ctx = useContext(CollabContext);
  if (!ctx) {
    throw new Error('useCollabContext 必须在 CollabProvider 内部使用');
  }
  return ctx;
}
