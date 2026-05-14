/**
 * Sidebar.jsx — 左侧边栏
 *
 * 结构：
 *   上方 - 操作按钮区：新建目录 / 新建文件 / 归档 / 删除
 *   下方 - 文件树渲染区（由模块 C 的 FileTree 组件填充）
 *
 * Props（均由父组件 AppLayout 传入）：
 *   treeData          {Array}    目录树数组（来自模块 C）
 *   selectedFileId    {number|null}  当前选中的文件 ID
 *   onFileSelect      {function(fileId)}  点击文件回调
 *   onNewDir          {function()}  点击"新建目录"回调
 *   onNewFile         {function()}  点击"新建文件"回调
 *   onArchive         {function()}  点击"归档"回调
 *   onDelete          {function()}  点击"删除"回调
 *   isAdmin           {boolean}   是否管理员（控制删除/新建按钮可见性）
 *   children          {React.ReactNode}  文件树组件插槽（模块 C 注入）
 */

import React from 'react';

/** 侧边栏固定宽度（与文档规范一致） */
export const SIDEBAR_WIDTH = 200;

/**
 * 通用图标按钮
 * @param {{ icon, label, onClick, disabled, danger }} props
 */
function ActionBtn({ icon, label, onClick, disabled = false, danger = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        ...styles.actionBtn,
        ...(disabled ? styles.actionBtnDisabled : {}),
        ...(danger ? styles.actionBtnDanger : {}),
      }}
    >
      <span style={styles.actionIcon}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({
  treeData = [],
  selectedFileId = null,
  selectedDirId = null,
  onFileSelect,
  onNewDir,
  onNewFile,
  onArchive,
  onDelete,
  isAdmin = false,
  children,
}) {
  // BUG FIX：归档/删除按钮需同时响应文件和目录的选中状态
  const hasSelection = selectedFileId !== null || selectedDirId !== null;

  /**
   * 跳转到管理后台
   */
  const handleGoAdmin = () => {
    window.location.href = '/app/admin';
  };

  return (
    <aside style={styles.sidebar}>
      {/* 操作按钮区 */}
      <div style={styles.actions}>
        <div style={styles.actionsTitle}>操作</div>

        {isAdmin && (
          <ActionBtn
            icon="📁"
            label="新建目录"
            onClick={onNewDir}
          />
        )}

        <ActionBtn
          icon="📄"
          label="新建文件"
          onClick={onNewFile}
          disabled={!isAdmin && treeData.length === 0}
        />

        <ActionBtn
          icon="🗂"
          label="归档"
          onClick={onArchive}
          disabled={!hasSelection}
        />

        {isAdmin && (
          <ActionBtn
            icon="🗑"
            label="删除"
            onClick={onDelete}
            disabled={!hasSelection}
            danger
          />
        )}
      </div>

      {/* 分隔线 */}
      <div style={styles.sep} />

      {/* 文件树区域（模块 C 注入的 FileTree 组件） */}
      <div style={styles.treeArea}>
        {children ?? (
          // 尚未注入模块 C 时的占位提示
          <div style={styles.emptyHint}>
            <span style={styles.emptyIcon}>📂</span>
            <span>暂无文件目录</span>
          </div>
        )}
      </div>

      {/* 管理后台入口（仅管理员可见） */}
      {isAdmin && (
        <>
          <div style={styles.sep} />
          <div style={styles.adminSection}>
            <ActionBtn
              icon="⚙️"
              label="管理后台"
              onClick={handleGoAdmin}
            />
          </div>
        </>
      )}
    </aside>
  );
}

const styles = {
  sidebar: {
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    maxWidth: SIDEBAR_WIDTH,
    height: '100%',
    background: '#F8FAFC',
    borderRight: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  actions: {
    padding: '12px 10px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  actionsTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#94A3B8',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    padding: '0 4px 6px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    width: '100%',
    padding: '6px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    color: '#374151',
    cursor: 'pointer',
    transition: 'background 0.12s',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  actionBtnDisabled: {
    opacity: 0.38,
    cursor: 'not-allowed',
  },
  actionBtnDanger: {
    color: '#DC2626',
  },
  actionIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  sep: {
    height: 1,
    background: '#E2E8F0',
    margin: '4px 0',
  },
  treeArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '6px 0',
  },
  emptyHint: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '32px 16px',
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 28,
    opacity: 0.5,
  },
  adminSection: {
    padding: '8px 10px 12px',
    background: '#FEF3C7',
    borderTop: '1px solid #FDE68A',
  },
};
