/**
 * 模块E：前端实时协作层 - 协作状态全局 Context
 *
 * 核心设计：
 *   - sheetId 同时用 state（驱动 useCollaboration 的 room:join/leave effect）
 *     和 ref（供 broadcastCellChange 同步读取，避免 React 异步 state 延迟）
 *   - setCollabSheet 空依赖，永不重建，避免触发 SpreadsheetEditor effect 重跑
 */

import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { useCollaboration } from './useCollaboration';

const CollabContext = createContext(null);

export function CollabProvider({ children }) {
  const [sheetId, setSheetId] = useState(null);

  // ── 关键：用 ref 同步保存最新 sheetId，供 broadcastCellChange 同步读取 ──
  const sheetIdRef = useRef(null);

  // 各种回调 ref
  const onRemoteCellChangeRef      = useRef(null);
  const onRemoteStyleChangeRef     = useRef(null);

  const onRemoteCellChange = useCallback((row, col, value) => {
    onRemoteCellChangeRef.current?.(row, col, value);
  }, []);

  // 把外部 sheetIdRef 传给 useCollaboration，让它的 broadcast 直接读 ref
  const collab = useCollaboration(sheetId, onRemoteCellChange, sheetIdRef);

  // setCollabSheet：空依赖，永远是同一个函数引用
  const setCollabSheet = useCallback((sid, cellCb, styleCb, structureCb) => {
    // 同步更新 ref（立即生效，不等 React re-render）
    sheetIdRef.current = sid;
    // 更新回调 ref
    onRemoteCellChangeRef.current      = cellCb      || null;
    onRemoteStyleChangeRef.current     = styleCb     || null;
    if (collab.onRemoteStyleChangeRef) {
      collab.onRemoteStyleChangeRef.current = styleCb || null;
    }
    if (collab.onRemoteStructureChangeRef) {
      collab.onRemoteStructureChangeRef.current = structureCb || null;
    }
    // 异步更新 state（触发 useCollaboration 的 room:join/leave effect）
    setSheetId(sid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CollabContext.Provider value={{ ...collab, setCollabSheet }}>
      {children}
    </CollabContext.Provider>
  );
}

export function useCollabContext() {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error('useCollabContext 必须在 CollabProvider 内部使用');
  return ctx;
}
