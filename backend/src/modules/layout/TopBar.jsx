/**
 * TopBar.jsx — 顶部导航栏
 *
 * 内容（从左到右）：
 *   - Logo + 系统名称
 *   - 面包屑：当前文件路径（可选，由父组件传入）
 *   - 保存状态指示
 *   - 在线用户头像列表（来自模块 E）
 *   - 当前用户名 + 登出按钮
 *
 * Props:
 *   breadcrumbs   {Array<{ label, id? }>}   面包屑路径数组，最后一项为当前页
 *   saveStatus    {'saved'|'saving'|'unsaved'|null}  保存状态
 *   onlineUsers   {Array<{ userId, displayName, color }>}  来自模块 E
 */

import React from 'react';
import { useAuth } from '../auth/AuthContext';
import OnlineUsers from './OnlineUsers';

/** 保存状态文案与颜色映射 */
const SAVE_STATUS_MAP = {
  saved:   { text: '已保存', color: '#22C55E' },
  saving:  { text: '保存中...', color: '#F59E0B' },
  unsaved: { text: '未保存', color: '#EF4444' },
};

export default function TopBar({
  breadcrumbs = [],
  saveStatus = null,
  onlineUsers = [],
}) {
  const { user, logout } = useAuth();

  /**
   * 处理登出按钮点击
   */
  async function handleLogout() {
    try {
      await logout();
    } catch {
      // 忽略登出错误，AuthContext 已清除本地状态
    }
  }

  const statusInfo = saveStatus ? SAVE_STATUS_MAP[saveStatus] : null;

  return (
    <header style={styles.bar}>
      {/* 左区：Logo + 面包屑 */}
      <div style={styles.left}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="2" fill="#fff" />
            <rect x="16" y="2" width="10" height="10" rx="2" fill="#fff" opacity="0.6" />
            <rect x="2" y="16" width="10" height="10" rx="2" fill="#fff" opacity="0.6" />
            <rect x="16" y="16" width="10" height="10" rx="2" fill="#fff" />
          </svg>
          <span style={styles.logoText}>协作报表</span>
        </div>

        {/* 分隔线 */}
        {breadcrumbs.length > 0 && <div style={styles.divider} />}

        {/* 面包屑 */}
        <nav style={styles.breadcrumb} aria-label="路径">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id ?? idx}>
              {idx > 0 && <span style={styles.breadcrumbSep}>/</span>}
              <span
                style={{
                  ...styles.breadcrumbItem,
                  ...(idx === breadcrumbs.length - 1
                    ? styles.breadcrumbCurrent
                    : {}),
                }}
              >
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* 右区：保存状态 + 在线用户 + 用户信息 */}
      <div style={styles.right}>
        {/* 保存状态 */}
        {statusInfo && (
          <div style={styles.saveStatus}>
            <span
              style={{
                ...styles.saveDot,
                background: statusInfo.color,
              }}
            />
            <span style={{ ...styles.saveText, color: statusInfo.color }}>
              {statusInfo.text}
            </span>
          </div>
        )}

        {/* 在线用户头像列表（来自模块 E） */}
        <OnlineUsers users={onlineUsers} maxVisible={5} />

        {/* 分隔线 */}
        <div style={{ ...styles.divider, borderColor: 'rgba(255,255,255,0.2)' }} />

        {/* 当前用户 + 登出 */}
        <div style={styles.userArea}>
          <span style={styles.userName}>{user?.display_name || user?.username}</span>
          <button
            onClick={handleLogout}
            style={styles.logoutBtn}
            aria-label="退出登录"
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}

const styles = {
  bar: {
    height: 52,
    background: '#1E40AF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px 0 12px',
    flexShrink: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  logoText: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '-0.2px',
  },
  divider: {
    height: 18,
    borderLeft: '1px solid rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  breadcrumbSep: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    flexShrink: 0,
  },
  breadcrumbItem: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'default',
  },
  breadcrumbCurrent: {
    color: '#fff',
    fontWeight: 600,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
  },
  saveStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  saveDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  saveText: {
    fontSize: 12,
    fontWeight: 500,
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  userName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: 500,
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    padding: '3px 10px',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  },
};
