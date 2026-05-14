/**
 * authApi.js — 认证相关 API 调用函数
 *
 * 封装所有与 /api/auth/* 交互的函数。
 * Token 由 AuthContext 持有，通过 Axios 拦截器自动注入 Header，
 * 本文件无需手动传入 token。
 */

import axios from 'axios';

/**
 * Axios 实例（所有模块共享同一实例，拦截器在 AuthContext 中注册）
 *
 * BUG FIX：生产构建时前端由后端静态服务（同源），baseURL 应为 ''（相对路径）。
 * 开发模式下通过 Vite proxy 转发，也无需写死 localhost:3000。
 * 仅当明确配置了 VITE_API_BASE_URL 环境变量时才使用绝对地址。
 */
export const apiClient = axios.create({
  baseURL:  '',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 登录接口
 * POST /api/auth/login
 *
 * @param {string} username - 用户名
 * @param {string} password - 明文密码
 * @returns {Promise<{ token: string, user: object }>}
 * @throws 登录失败时抛出错误，error.message 为后端返回的中文说明
 */
export async function loginRequest(username, password) {
  const res = await apiClient.post('/api/auth/login', { username, password });
  if (!res.data.success) {
    throw new Error(res.data.error || '登录失败');
  }
  return res.data.data; // { token, user }
}

/**
 * 登出接口
 * POST /api/auth/logout
 * 将当前 Token 加入后端黑名单。
 *
 * @returns {Promise<void>}
 */
export async function logoutRequest() {
  await apiClient.post('/api/auth/logout');
}

/**
 * 获取当前登录用户信息
 * GET /api/auth/me
 *
 * @returns {Promise<{ id, username, display_name, role }>}
 */
export async function getMeRequest() {
  const res = await apiClient.get('/api/auth/me');
  if (!res.data.success) {
    throw new Error(res.data.error || '获取用户信息失败');
  }
  return res.data.data;
}
