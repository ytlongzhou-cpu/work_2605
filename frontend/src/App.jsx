import React, { useState, useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom';
import { AuthProvider } from './modules/auth/AuthContext';
import PrivateRoute from './modules/auth/PrivateRoute';
import LoginPage from './modules/auth/LoginPage';
import AppLayout from './modules/layout/AppLayout';
import SpreadsheetEditor from './modules/spreadsheet/SpreadsheetEditor';
import AdminPage from './modules/admin/AdminPage';
import { CollabProvider } from './modules/collaboration/CollabContext';

function DefaultContent() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', color: '#94A3B8', gap: 12,
      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    }}>
      <span style={{ fontSize: 48, opacity: 0.4 }}>📊</span>
      <p style={{ margin: 0, fontSize: 14 }}>请从左侧选择文件开始编辑</p>
    </div>
  );
}

// BUG FIX: 路由参数名与 SpreadsheetEditor props 对齐，用 fileId
function SheetRoute() {
  const { fileId } = useParams();
  return <SpreadsheetEditor fileId={Number(fileId)} />;
}

/**
 * CollabWrapper：在 AppLayout 内部使用，持有 collabSheetId 状态，
 * 并将 onRemoteCellChange 回调通过 Context 向下传递。
 * CollabProvider 必须知道当前 sheetId，而 sheetId 在 SpreadsheetEditor 内部
 * 才能得知（fileId -> sheetId），因此这里通过 null 初始化，
 * SpreadsheetEditor 通过 useCollabContext 内的 setSheetId 更新。
 */
export default function App() {
  return (
    <AuthProvider>
      {/* CollabProvider 的 sheetId 和 onRemoteCellChange 由 SpreadsheetEditor 内部通过 Context 更新 */}
      <CollabProvider sheetId={null} onRemoteCellChange={null}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<PrivateRoute />}>
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<DefaultContent />} />
                {/* BUG FIX: 路由参数改为 fileId，与 SheetRoute 内 useParams 对应 */}
                <Route path="sheet/:fileId" element={<SheetRoute />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </CollabProvider>
    </AuthProvider>
  );
}
