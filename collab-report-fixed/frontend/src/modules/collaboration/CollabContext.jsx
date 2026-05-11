/**
 * 模块E：前端实时协作层 - 协作状态全局 Context
 *
 * 将 useCollaboration 的状态提升为全局 Context，方便模块B（在线用户列表）
 * 和模块D（表格编辑器）跨层级访问，无需逐层传递 props。
 *
 * 使用方式：
 *   // 在 App.jsx 或主框架中包裹（需在 AuthProvider 内部）：
 *   <CollabProvider sheetId={currentSheetId} onRemoteCellChange={handleRemoteChange}>
 *     <AppLayout />
 *   </CollabProvider>
 *
 *   // 在任意子组件中消费：
 *   const { onlineUsers, otherCursors, broadcastCellChange, broadcastCursorMove }
 *     = useCollabContext();
 */

import React, { createContext, useContext } from 'react';
import { useCollaboration } from './useCollaboration';

/** @type {React.Context} */
const CollabContext = createContext(null);

/**
 * 协作状态 Provider
 * @param {{
 *   sheetId: number|null,
 *   onRemoteCellChange: Function,
 *   children: React.ReactNode
 * }} props
 */
export function CollabProvider({ sheetId, onRemoteCellChange, children }) {
  const collab = useCollaboration(sheetId, onRemoteCellChange);

  return (
    <CollabContext.Provider value={collab}>
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
 * }}
 */
export function useCollabContext() {
  const ctx = useContext(CollabContext);
  if (!ctx) {
    throw new Error('useCollabContext 必须在 CollabProvider 内部使用');
  }
  return ctx;
}
