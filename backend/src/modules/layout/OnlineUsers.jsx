/**
 * OnlineUsers.jsx — 在线用户头像列表组件
 *
 * 接收来自模块 E（实时协作层）提供的在线用户列表，
 * 以彩色头像气泡形式展示在顶部栏右侧。
 * 超过 maxVisible 人时折叠显示 +N。
 *
 * Props:
 *   users        {Array<{ userId, displayName, color }>}  在线用户列表
 *   maxVisible   {number}  最多显示几个头像，默认 5
 */

import React, { useState } from 'react';

/**
 * 从用户姓名中提取首字母（取第一个汉字或首字母大写）。
 *
 * @param {string} name - 用户显示名
 * @returns {string} 头像字母（最多 1 个字符）
 */
function getInitial(name) {
  if (!name) return '?';
  // 若首字符是中文，直接取第一个字
  if (/[\u4e00-\u9fa5]/.test(name[0])) return name[0];
  return name[0].toUpperCase();
}

export default function OnlineUsers({ users = [], maxVisible = 5 }) {
  const [showTooltip, setShowTooltip] = useState(null); // userId of hovered avatar

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div style={styles.container} aria-label={`${users.length} 人在线`}>
      {/* 在线标识 */}
      <span style={styles.onlineDot} />
      <span style={styles.countText}>{users.length} 人在线</span>

      {/* 头像列表（反向叠加：后面的在上层） */}
      <div style={styles.avatarRow}>
        {visible.map((u, idx) => (
          <div
            key={u.userId}
            style={{
              ...styles.avatarWrap,
              zIndex: visible.length - idx,
              marginLeft: idx === 0 ? 0 : -8,
            }}
            onMouseEnter={() => setShowTooltip(u.userId)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            {/* 头像气泡 */}
            <div
              style={{
                ...styles.avatar,
                background: u.color || '#2563EB',
              }}
            >
              {getInitial(u.displayName)}
            </div>

            {/* Hover Tooltip */}
            {showTooltip === u.userId && (
              <div style={styles.tooltip}>{u.displayName}</div>
            )}
          </div>
        ))}

        {/* 溢出计数气泡 */}
        {overflow > 0 && (
          <div
            style={{
              ...styles.avatarWrap,
              zIndex: 0,
              marginLeft: -8,
            }}
          >
            <div style={{ ...styles.avatar, background: '#94A3B8' }}>
              +{overflow}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22C55E',
    boxShadow: '0 0 0 2px rgba(34,197,94,0.25)',
    flexShrink: 0,
  },
  countText: {
    fontSize: 12,
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  avatarRow: {
    display: 'flex',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    cursor: 'default',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    border: '2px solid #1E40AF',
    userSelect: 'none',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  tooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#0F172A',
    color: '#fff',
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 100,
  },
};
