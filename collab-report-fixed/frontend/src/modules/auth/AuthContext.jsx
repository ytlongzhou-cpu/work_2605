/**
 * AuthContext.jsx — 全局认证状态管理
 *
 * 提供：
 *   - user: 当前用户对象（null 表示未登录）
 *   - token: 内存中持有的 JWT（不写 localStorage）
 *   - login(username, password): 登录，成功后注入 Axios 拦截器
 *   - logout(): 清除状态并通知后端
 *   - loading: 初始化检测中的加载态
 *
 * Token 保存在内存变量中（不用 localStorage），
 * 刷新页面后需重新登录（符合安全要求）。
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { apiClient, loginRequest, logoutRequest } from './authApi';

const AuthContext = createContext(null);

/**
 * 自定义 Hook，消费认证上下文。
 * 必须在 <AuthProvider> 内部使用，否则抛出错误。
 *
 * @returns {{ user, token, login, logout, loading }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 <AuthProvider> 内使用');
  }
  return ctx;
}

/**
 * AuthProvider — 认证状态提供者
 * 包裹整个应用，向子组件提供认证上下文。
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  /** 当前用户信息，null 表示未登录 */
  const [user, setUser] = useState(null);
  /** 内存中的 JWT Token */
  const [token, setToken] = useState(null);
  /** 是否正在初始化（首次挂载检测 token 有效性） */
  const [loading, setLoading] = useState(false);

  /**
   * Axios 请求拦截器 ID，用于在 logout 时移除拦截器。
   * 使用 ref 避免触发重渲染。
   */
  const interceptorId = useRef(null);

  /**
   * 安装 Axios 请求拦截器，自动在每次请求中附加 Bearer Token。
   *
   * @param {string} jwt - 要注入的 token
   */
  const installInterceptor = useCallback((jwt) => {
    // 移除上一个拦截器（防止重复安装）
    if (interceptorId.current !== null) {
      apiClient.interceptors.request.eject(interceptorId.current);
    }
    interceptorId.current = apiClient.interceptors.request.use((config) => {
      config.headers['Authorization'] = `Bearer ${jwt}`;
      return config;
    });
  }, []);

  /**
   * 安装 Axios 响应拦截器：
   * 当后端返回 401 时，自动清除状态并跳回登录页。
   * 仅安装一次（应用挂载时）。
   */
  useEffect(() => {
    const id = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token 过期或失效，静默清除状态
          setUser(null);
          setToken(null);
          if (interceptorId.current !== null) {
            apiClient.interceptors.request.eject(interceptorId.current);
            interceptorId.current = null;
          }
        }
        return Promise.reject(error);
      }
    );
    return () => {
      apiClient.interceptors.response.eject(id);
    };
  }, []);

  /**
   * login — 登录操作
   * 调用后端接口 → 保存 token 和 user → 安装 Axios 拦截器
   *
   * @param {string} username
   * @param {string} password
   * @returns {Promise<void>}
   * @throws 登录失败时抛出，调用方负责展示错误信息
   */
  const login = useCallback(async (username, password) => {
    const { token: jwt, user: userData } = await loginRequest(username, password);
    setToken(jwt);
    setUser(userData);
    installInterceptor(jwt);
  }, [installInterceptor]);

  /**
   * logout — 登出操作
   * 通知后端使 token 失效 → 清除本地状态 → 移除拦截器
   *
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // 即使后端请求失败，仍清除本地状态
    } finally {
      setUser(null);
      setToken(null);
      if (interceptorId.current !== null) {
        apiClient.interceptors.request.eject(interceptorId.current);
        interceptorId.current = null;
      }
    }
  }, []);

  const value = { user, token, login, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
