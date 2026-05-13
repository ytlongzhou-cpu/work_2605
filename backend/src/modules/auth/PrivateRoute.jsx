/**
 * PrivateRoute.jsx — 路由守卫组件
 *
 * 用法：将需要登录才能访问的路由用 <PrivateRoute> 包裹。
 *
 * 行为：
 *   - 已登录 → 渲染子路由（<Outlet />）
 *   - 未登录 → 重定向到 /login，并记录来源路径以便登录后跳回
 *   - 初始化加载中 → 显示全屏 Loading（防止闪烁跳转）
 *
 * 示例路由配置：
 *   <Route element={<PrivateRoute />}>
 *     <Route path="/app" element={<AppLayout />} />
 *   </Route>
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * PrivateRoute 路由守卫
 * 无需 Props，自动从 AuthContext 读取登录状态。
 */
export default function PrivateRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 初始化检测期间显示 Loading，避免未授权跳转闪烁
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#f5f5f5',
          color: '#666',
          fontSize: '14px',
          fontFamily: 'sans-serif',
        }}
      >
        正在初始化...
      </div>
    );
  }

  // 未登录：重定向到登录页，携带来源路径
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 已登录：正常渲染子路由
  return <Outlet />;
}
