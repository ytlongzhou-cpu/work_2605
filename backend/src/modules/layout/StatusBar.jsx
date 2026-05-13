/**
 * StatusBar.jsx — 底部状态栏
 *
 * 显示当前协作状态：
 *   - 实时同步状态指示
 *   - 其他用户正在编辑的单元格信息
 *   - 当前工作表统计信息（求和、平均、计数等）
 *
 * Props:
 *   collaborators   {Array<{ userId, displayName, cell }>} 正在编辑的用户列表
 *   syncStatus      {'syncing'|'synced'|'error'} 同步状态
 *   stats           {{ sum, avg, count }} 单元格统计信息
 */

import React from 'react';

export default function StatusBar({ collaborators = [], syncStatus = 'synced', stats = {} }) {
  const syncText = {
    syncing: '实时同步中…',
    synced:  '已同步',
    error:   '连接断开',
  };

  const syncColor = {
    syncing: '#F59E0B',
    synced:  '#22C55E',
    error:   '#EF4444',
  };

  return (
    <footer style={styles.bar}>
      {/* 左侧：同步状态 + 协作编辑信息 */}
      <div style={styles.left}>
        <div style={styles.syncStatus}>
          <span style={{ ...styles.statusDot, background: syncColor[syncStatus] }} />
          <span style={{ color: syncColor[syncStatus], ...styles.statusText }}>
            {syncText[syncStatus]}
          </span>
        </div>

        {/* 分隔线 */}
        <div style={styles.divider} />

        {/* 协作编辑信息 */}
        {collaborators.length > 0 && (
          <div style={styles.collaborators}>
            {collaborators.map((c, idx) => (
              <span key={c.userId} style={styles.collaboratorItem}>
                {idx > 0 && <span style={styles.sep}>、</span>}
                {/* BUG FIX：加上颜色色块标识用户 */}
                {c.color && (
                  <span style={{ ...styles.colorDot, background: c.color }} />
                )}
                <span style={{ color: c.color || '#1E40AF', fontWeight: 500 }}>{c.displayName}</span>
                <span style={styles.cellText}>正在编辑 {c.cell}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 右侧：统计信息 */}
      <div style={styles.right}>
        {stats.sum !== undefined && (
          <span style={styles.statItem}>
            <span style={styles.statLabel}>求和:</span>
            <span style={styles.statValue}>{stats.sum.toLocaleString()}</span>
          </span>
        )}
        {stats.avg !== undefined && (
          <span style={styles.statItem}>
            <span style={styles.statLabel}>平均:</span>
            <span style={styles.statValue}>{stats.avg.toFixed(2)}</span>
          </span>
        )}
        {stats.count !== undefined && (
          <span style={styles.statItem}>
            <span style={styles.statLabel}>计数:</span>
            <span style={styles.statValue}>{stats.count}</span>
          </span>
        )}
      </div>
    </footer>
  );
}

const styles = {
  bar: {
    height: 28,
    background: '#F1F5F9',
    borderTop: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    flexShrink: 0,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  syncStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 500,
  },
  divider: {
    width: 1,
    height: 14,
    background: '#E2E8F0',
  },
  collaborators: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  collaboratorItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  sep: {
    color: '#94A3B8',
  },
  cellText: {
    fontSize: 12,
    color: '#64748B',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  statValue: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1E40AF',
  },
};
