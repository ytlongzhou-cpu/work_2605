import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCollabContext } from '../collaboration/CollabContext';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import FileTreeItem from '../file-manager/FileTreeItem';
import NewDirModal from '../file-manager/NewDirModal';
import NewFileModal from '../file-manager/NewFileModal';
import {
  getDirectories, getFiles,
  createDirectory, createFile,
  deleteDirectory, deleteFile,
  toggleDirectoryArchive, toggleFileArchive,
} from '../file-manager/fileApi';

const LayoutContext = createContext(null);
export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout 必须在 <AppLayout> 内使用');
  return ctx;
}

/**
 * BUG FIX：将平铺目录列表递归构建成树（与 useFileTree.js 保持一致）
 * 注意：只过滤非归档目录进入正常树；归档目录单独收集
 */
function buildTree(dirs, filesMap, parentId = null, archivedOnly = false) {
  return dirs
    .filter(d => (d.parent_id ?? null) === parentId && (archivedOnly ? d.is_archived : !d.is_archived))
    .map(d => ({
      ...d,
      children: [
        ...buildTree(dirs, filesMap, d.id, false),
        ...(filesMap.get(d.id) || []).filter(f => !f.is_archived),
      ],
    }));
}

function buildArchivedItems(dirs, filesMap) {
  // 归档文件（来自非归档目录下的归档文件）
  const archivedFiles = [];
  for (const [dirId, files] of filesMap) {
    // 找到该目录是否归档
    const dir = dirs.find(d => d.id === dirId);
    const dirArchived = dir?.is_archived;
    for (const f of files) {
      // 单独归档的文件 OR 归档目录下的所有文件
      if (f.is_archived || dirArchived) {
        // 避免重复（归档目录下的文件会在归档目录条目里显示）
        if (!dirArchived) archivedFiles.push(f);
      }
    }
  }
  // 归档目录（含其下所有文件作为 children）
  const archivedDirs = dirs.filter(d => d.is_archived).map(d => ({
    ...d,
    children: (filesMap.get(d.id) || []).map(f => ({ ...f })),
  }));
  return [...archivedDirs, ...archivedFiles];
}

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  // ── 协作层（用于底部状态栏 & 顶部在线用户）──
  const { otherCursors, globalOnlineUsers, socketConnected } = useCollabContext();

  // ── 文件树状态 ──
  const [treeData, setTreeData] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]); // BUG FIX：归档区
  const [showArchived, setShowArchived] = useState(true); // 默认展开，让用户知道有归档区
  const [flatDirs, setFlatDirs] = useState([]); // 平铺目录，供 NewFileModal 使用
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [selectedDirId, setSelectedDirId] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── 弹窗状态 ──
  const [showNewDir, setShowNewDir] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);

  // ── TopBar 状态 ──
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null);
  // BUG FIX：真实同步状态，由 SpreadsheetEditor 写入
  const [syncStatus, setSyncStatus] = useState('synced');

  // ── 加载目录树 ──
  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      // BUG FIX：获取所有目录（含归档目录，后端 getDirectories 对 admin 返回所有）
      const res = await getDirectories();
      if (res.success) {
        const dirs = res.data;
        setFlatDirs(dirs.filter(d => !d.is_archived));
        // BUG FIX：并发加载所有目录下的所有文件（含归档文件），供「已归档」区使用
        const filesEntries = await Promise.all(
          dirs.map(async dir => {
            const fr = await getFiles(dir.id, true); // include_archived=true
            return [dir.id, fr.success ? fr.data : []];
          })
        );
        const filesMap = new Map(filesEntries);
        setTreeData(buildTree(dirs, filesMap, null, false));
        // 收集归档内容供侧边栏「已归档」区展示
        setArchivedItems(buildArchivedItems(dirs, filesMap));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  // ── 按钮回调 ──
  const handleNewDir = () => setShowNewDir(true);

  const handleNewFile = () => {
    if (flatDirs.length === 0) { alert('请先新建目录'); return; }
    setShowNewFile(true);
  };

  const handleArchive = async () => {
    if (!selectedFileId && !selectedDirId) return;
    if (selectedFileId) {
      await toggleFileArchive(selectedFileId);
      setSelectedFileId(null);
    } else {
      await toggleDirectoryArchive(selectedDirId);
      setSelectedDirId(null);
    }
    loadTree();
  };

  const handleDelete = async () => {
    if (!selectedFileId && !selectedDirId) return;
    if (selectedFileId) {
      if (!window.confirm('确认删除此文件？')) return;
      await deleteFile(selectedFileId);
      setSelectedFileId(null);
      navigate('/app');
    } else {
      if (!window.confirm('确认删除此目录？目录必须为空才能删除。')) return;
      const res = await deleteDirectory(selectedDirId);
      if (!res.success) { alert(res.error); return; }
      setSelectedDirId(null);
    }
    loadTree();
  };

  const handleFileSelect = (fileId) => {
    setSelectedFileId(fileId);
    navigate(`/app/sheet/${fileId}`);
  };

  const layoutValue = {
    breadcrumbs, saveStatus, syncStatus,
    setBreadcrumbs, setSaveStatus, setSyncStatus,
    reload: loadTree,
  };

  // BUG FIX：从协作层读取真实的其他用户编辑状态（而非伪造数据）
  const collaborators = otherCursors.map(u => ({
    userId:      u.userId,
    displayName: u.displayName,
    color:       u.color,
    cell:        u.row != null && u.col != null
      ? `${String.fromCharCode(65 + u.col)}${u.row + 1}`
      : null,
  })).filter(c => c.cell !== null);

  // BUG FIX：socket 断线时状态栏应显示「连接断开」而非「已同步」
  const effectiveSyncStatus = !socketConnected ? 'error' : syncStatus;

  return (
    <LayoutContext.Provider value={layoutValue}>
      <div style={styles.root}>
        <TopBar breadcrumbs={breadcrumbs} saveStatus={saveStatus} onlineUsers={globalOnlineUsers} />

        <div style={styles.body}>
          <Sidebar
            treeData={treeData}
            selectedFileId={selectedFileId}
            selectedDirId={selectedDirId}
            onFileSelect={handleFileSelect}
            onNewDir={handleNewDir}
            onNewFile={handleNewFile}
            onArchive={handleArchive}
            onDelete={handleDelete}
            isAdmin={isAdmin}
          >
            {loading ? (
              <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>加载中…</div>
            ) : treeData.length === 0 && archivedItems.length === 0 ? (
              <div style={styles.emptyHint}>
                <span style={{ fontSize: 28, opacity: 0.4 }}>📂</span>
                <span>暂无文件目录</span>
              </div>
            ) : (
              <>
                {treeData.map(node => (
                  <FileTreeItem
                    key={node.id}
                    node={node}
                    onFileSelect={handleFileSelect}
                    onReload={loadTree}
                    currentUser={user}
                    selectedFileId={selectedFileId}
                    onDirSelect={setSelectedDirId}
                  />
                ))}

                {/* 归档区：始终显示，让用户知道去哪找归档文件 */}
                <div style={styles.archivedSection}>
                  <div
                    style={styles.archivedHeader}
                    onClick={() => setShowArchived(v => !v)}
                  >
                    <span style={styles.archivedArrow}>{showArchived ? '▾' : '▸'}</span>
                    <span style={styles.archivedIcon}>🗂</span>
                    <span style={styles.archivedLabel}>已归档</span>
                    {archivedItems.length > 0 && (
                      <span style={styles.archivedCount}>{archivedItems.length}</span>
                    )}
                  </div>
                  {showArchived && (
                    archivedItems.length === 0
                      ? <div style={{ padding:'6px 12px', fontSize:12, color:'#C0CADB' }}>暂无归档文件</div>
                      : archivedItems.map(node => (
                          <div key={`${node.children ? 'dir' : 'file'}-${node.id}`} style={{ paddingLeft: 8 }}>
                            <FileTreeItem
                              node={node}
                              onFileSelect={handleFileSelect}
                              onReload={loadTree}
                              currentUser={user}
                              selectedFileId={selectedFileId}
                              onDirSelect={setSelectedDirId}
                            />
                          </div>
                        ))
                  )}
                </div>
              </>
            )}
          </Sidebar>

          <main style={styles.content}>
            <Outlet />
          </main>
        </div>

        {/* BUG FIX：底部状态栏使用真实协作数据和同步状态 */}
        <StatusBar
          collaborators={collaborators}
          syncStatus={effectiveSyncStatus}
          stats={{}}
        />

        {showNewDir && (
          <NewDirModal
            onClose={() => setShowNewDir(false)}
            onConfirm={async (name) => {
              const res = await createDirectory(name, null);
              if (!res.success) alert(res.error);
              else loadTree();
            }}
          />
        )}

        {showNewFile && (
          <NewFileModal
            directories={flatDirs}
            onClose={() => setShowNewFile(false)}
            onConfirm={async (name, dirId) => {
              const res = await createFile(name, dirId);
              if (!res.success) alert(res.error);
              else loadTree();
            }}
          />
        )}
      </div>
    </LayoutContext.Provider>
  );
}

const styles = {
  root: { display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#F1F5F9' },
  body: { display:'flex', flex:1, overflow:'hidden' },
  content: { flex:1, overflow:'auto', position:'relative' },
  emptyHint: { display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'32px 16px', color:'#94A3B8', fontSize:12 },
  archivedSection: {
    marginTop: 8,
    borderTop: '1px solid #E2E8F0',
  },
  archivedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  archivedArrow: { fontSize: 10, color: '#94A3B8', width: 12, flexShrink: 0 },
  archivedIcon: { fontSize: 14, flexShrink: 0 },
  archivedLabel: { fontSize: 13, color: '#94A3B8', flex: 1 },
  archivedCount: {
    fontSize: 10,
    color: '#fff',
    background: '#94A3B8',
    borderRadius: 8,
    padding: '1px 6px',
    fontWeight: 600,
  },
};
