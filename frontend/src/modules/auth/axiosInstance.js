/**
 * axiosInstance.js — 全局 Axios 单例（共享实例）
 *
 * BUG FIX：原版从 localStorage 读取 token，与开发规范（Token 只存内存）矛盾，
 * 且 AuthContext 已经在同一 axios 实例上注册了请求拦截器（Bearer token 注入）。
 * 两个拦截器并存会导致冲突：LocalStorage 总是空的，请求没有 Authorization 头。
 *
 * 修复方案：
 *   - axiosInstance 直接复用 authApi.js 中的 apiClient（同一实例）
 *   - 这样 AuthContext 注册的 Bearer 拦截器对所有模块的请求都生效
 *   - 不再自行管理 localStorage / 跳转逻辑（AuthContext 已统一处理 401）
 */

// 直接复用 authApi 中的共享 apiClient，保证拦截器只注册一次
export { apiClient as default } from './authApi';
