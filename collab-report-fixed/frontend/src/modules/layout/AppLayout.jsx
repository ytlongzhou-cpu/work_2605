import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
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

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  // ── 文件树状态 ──
  const [treeData, setTreeData] = useState([]);
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
    const res = await getDirectories();
    if (res.success) {
      const withFiles = await Promise.all(
        res.data.map(async dir => {
          const fr = await getFiles(dir.id);
          return { ...dir, children: fr.success ? fr.data : [] };
        })
      );
      setTreeData(withFiles);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  // ── 按钮回调 ──
  const handleNewDir = () => setShowNewDir(true);

  const handleNewFile = () => {
    if (treeData.length === 0) { alert('请先新建目录'); return; }
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
            directories={treeData}
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
