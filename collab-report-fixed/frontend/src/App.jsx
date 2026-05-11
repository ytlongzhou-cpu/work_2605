import React from 'react';
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

function SheetRoute() {
  const { sheetId } = useParams();
  return <SpreadsheetEditor fileId={Number(sheetId)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <CollabProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<PrivateRoute />}>
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<DefaultContent />} />
                <Route path="sheet/:sheetId" element={<SheetRoute />} />
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
