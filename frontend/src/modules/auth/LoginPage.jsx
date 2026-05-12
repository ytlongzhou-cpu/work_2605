/**
 * LoginPage.jsx — 登录页面组件
 *
 * 功能：
 *   - 用户名 + 密码表单，Enter 键可提交
 *   - 提交调用 AuthContext.login()
 *   - 成功后跳转至登录前访问的页面（或默认 /app）
 *   - 失败时展示后端返回的错误信息
 *   - 防重复提交：请求期间按钮禁用并显示加载态
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** 登录表单初始状态 */
const INITIAL_FORM = { username: '', password: '' };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /** 登录后跳回的目标路径（来自路由守卫记录） */
  const from = location.state?.from?.pathname || '/app';

  /**
   * 处理表单字段变更
   * @param {React.ChangeEvent<HTMLInputElement>} e
   */
  function handleChange(e) {
    setError('');
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  /**
   * 提交登录表单
   * @param {React.FormEvent} e
   */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('请输入用户名和密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(form.username.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* 背景装饰 */}
      <div style={styles.bgGrid} aria-hidden="true" />
      <div style={styles.bgAccent} aria-hidden="true" />

      <main style={styles.card}>
        {/* Logo / 标题区 */}
        <header style={styles.header}>
          <div style={styles.logoMark}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="2" fill="#2563EB" />
              <rect x="16" y="2" width="10" height="10" rx="2" fill="#2563EB" opacity="0.5" />
              <rect x="2" y="16" width="10" height="10" rx="2" fill="#2563EB" opacity="0.5" />
              <rect x="16" y="16" width="10" height="10" rx="2" fill="#2563EB" />
            </svg>
          </div>
          <h1 style={styles.title}>协作报表系统</h1>
          <p style={styles.subtitle}>Collaborative Report Platform</p>
        </header>

        {/* 表单 */}
        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="username">
              用户名
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={form.username}
              onChange={handleChange}
              disabled={submitting}
              placeholder="请输入用户名"
              style={{
                ...styles.input,
                ...(error ? styles.inputError : {}),
              }}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="password">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              disabled={submitting}
              placeholder="请输入密码"
              style={{
                ...styles.input,
                ...(error ? styles.inputError : {}),
              }}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={styles.errorBanner} role="alert">
              <span style={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.submitBtn,
              ...(submitting ? styles.submitBtnDisabled : {}),
            }}
          >
            {submitting ? (
              <>
                <span style={styles.spinner} />
                登录中...
              </>
            ) : (
              '登 录'
            )}
          </button>
        </form>

        <footer style={styles.footer}>
          <span>仅限局域网内授权用户访问</span>
        </footer>
      </main>

      <style>{spinnerCSS}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F0F4FF',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  bgGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(#CBD5E1 1px, transparent 1px), linear-gradient(90deg, #CBD5E1 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    opacity: 0.35,
  },
  bgAccent: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    background: '#fff',
    borderRadius: 16,
    padding: '44px 48px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 40px -8px rgba(37,99,235,0.12)',
    border: '1px solid rgba(37,99,235,0.08)',
  },
  header: {
    textAlign: 'center',
    marginBottom: 36,
  },
  logoMark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    background: '#EFF6FF',
    borderRadius: 14,
    marginBottom: 16,
  },
  title: {
    margin: '0 0 6px',
    fontSize: 22,
    fontWeight: 700,
    color: '#0F172A',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: 0,
    fontSize: 12,
    color: '#94A3B8',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    height: 44,
    padding: '0 14px',
    fontSize: 14,
    color: '#0F172A',
    background: '#F8FAFC',
    border: '1.5px solid #E2E8F0',
    borderRadius: 8,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    width: '100%',
    boxSizing: 'border-box',
  },
  inputError: {
    borderColor: '#EF4444',
    background: '#FFF5F5',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 8,
    fontSize: 13,
    color: '#B91C1C',
  },
  errorIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  submitBtn: {
    height: 46,
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.15s, transform 0.1s',
    marginTop: 4,
  },
  submitBtnDisabled: {
    background: '#93C5FD',
    cursor: 'not-allowed',
  },
  spinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  footer: {
    marginTop: 28,
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
  },
};

const spinnerCSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  input:focus { border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); background: #fff !important; }
  button[type=submit]:not(:disabled):hover { background: #1D4ED8 !important; }
  button[type=submit]:not(:disabled):active { transform: scale(0.98); }
`;
