import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
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
 */
function buildTree(dirs, filesMap, parentId = null) {
  return dirs
    .filter(d => (d.parent_id ?? null) === parentId)
    .map(d => ({
      ...d,
      children: [
        ...buildTree(dirs, filesMap, d.id),
        ...(filesMap.get(d.id) || []),
      ],
    }));
}

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  // ── 文件树状态 ──
  const [treeData, setTreeData] = useState([]);
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
  const [onlineUsers, setOnlineUsers] = useState([]);

  // ── 加载目录树 ──
  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDirectories();
      if (res.success) {
        const dirs = res.data;
        setFlatDirs(dirs);
        const filesEntries = await Promise.all(
          dirs.map(async dir => {
            const fr = await getFiles(dir.id);
            return [dir.id, fr.success ? fr.data : []];
          })
        );
        const filesMap = new Map(filesEntries);
        setTreeData(buildTree(dirs, filesMap, null));
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
    breadcrumbs, saveStatus, onlineUsers,
    setBreadcrumbs, setSaveStatus, setOnlineUsers,
    reload: loadTree,
  };

  // 模拟协作数据（实际应该从协作模块获取）
  const collaborators = onlineUsers.slice(1).map((u, idx) => ({
    userId: u.userId,
    displayName: u.displayName,
    cell: ['F3', 'D5', 'B7', 'C2', 'E9'][idx % 5],
  }));

  return (
    <LayoutContext.Provider value={layoutValue}>
      <div style={styles.root}>
        <TopBar breadcrumbs={breadcrumbs} saveStatus={saveStatus} onlineUsers={onlineUsers} />

        <div style={styles.body}>
          <Sidebar
            treeData={treeData}
            selectedFileId={selectedFileId}
            onFileSelect={handleFileSelect}
            onNewDir={handleNewDir}
            onNewFile={handleNewFile}
            onArchive={handleArchive}
            onDelete={handleDelete}
            isAdmin={isAdmin}
          >
            {loading ? (
              <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>加载中…</div>
            ) : treeData.length === 0 ? (
              <div style={styles.emptyHint}>
                <span style={{ fontSize: 28, opacity: 0.4 }}>📂</span>
                <span>暂无文件目录</span>
              </div>
            ) : (
              treeData.map(node => (
                <FileTreeItem
                  key={node.id}
                  node={node}
                  onFileSelect={handleFileSelect}
                  onReload={loadTree}
                  currentUser={user}
                  selectedFileId={selectedFileId}
                  onDirSelect={setSelectedDirId}
                />
              ))
            )}
          </Sidebar>

          <main style={styles.content}>
            <Outlet />
          </main>
        </div>

        {/* 底部状态栏 */}
        <StatusBar 
          collaborators={collaborators} 
          syncStatus="synced"
          stats={{ sum: 87200, avg: 14533.33, count: 6 }}
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
};
