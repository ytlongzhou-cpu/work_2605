import { useState, useEffect } from 'react';
import { getDirectories, getFiles, createDirectory, createFile, deleteDirectory, deleteFile, toggleDirectoryArchive, toggleFileArchive } from './fileApi';
import { useAuth } from '../auth/AuthContext';

export function useFileTree() {
  const { user } = useAuth();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTree = async () => {
    setLoading(true);
    const res = await getDirectories();
    if (res.success) {
      const treeWithFiles = await Promise.all(res.data.map(async dir => {
        const filesRes = await getFiles(dir.id);
        return { ...dir, children: filesRes.success ? filesRes.data : [] };
      }));
      setTreeData(treeWithFiles);
    }
    setLoading(false);
  };

  const addDirectory = async (name, parentId = null) => {
    const res = await createDirectory(name, parentId);
    if (res.success) loadTree();
    return res;
  };

  const addFile = async (name, directoryId) => {
    const res = await createFile(name, directoryId);
    if (res.success) loadTree();
    return res;
  };

  const removeDirectory = async (id) => {
    const res = await deleteDirectory(id);
    if (res.success) loadTree();
    return res;
  };

  const removeFile = async (id) => {
    const res = await deleteFile(id);
    if (res.success) loadTree();
    return res;
  };

  const archiveDirectory = async (id) => {
    const res = await toggleDirectoryArchive(id);
    if (res.success) loadTree();
    return res;
  };

  const archiveFile = async (id) => {
    const res = await toggleFileArchive(id);
    if (res.success) loadTree();
    return res;
  };

  useEffect(() => {
    loadTree();
  }, []);

  return {
    treeData,
    loading,
    addDirectory,
    addFile,
    removeDirectory,
    removeFile,
    archiveDirectory,
    archiveFile,
    reload: loadTree,
    currentUser: user,
  };
}
