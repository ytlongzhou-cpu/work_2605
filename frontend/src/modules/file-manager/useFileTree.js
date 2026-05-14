/**
 * BUG FIX：原版只对平铺目录列表的每个 dir 加载 files，没有递归构建多级子目录树。
 * 修复：后端返回的 directories 是平铺列表，前端用 parent_id 递归构建树，
 * 只对叶子目录（或任意目录）加载文件，最终组成 {id, name, children(dirs+files)} 结构。
 */
import { useState, useEffect, useCallback } from 'react';
import { getDirectories, getFiles, createDirectory, createFile, deleteDirectory, deleteFile, toggleDirectoryArchive, toggleFileArchive } from './fileApi';
import { useAuth } from '../auth/AuthContext';

/**
 * 将平铺目录列表 + 各目录的 files 构建成递归树
 * @param {Array} dirs  - 平铺目录数组 [{ id, name, parent_id, ... }]
 * @param {Map}   filesMap - dirId -> [files]
 * @param {number|null} parentId
 * @returns {Array}
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

export function useFileTree() {
  const { user } = useAuth();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDirectories();
      if (!res.success) { setLoading(false); return; }

      const dirs = res.data;
      // 并发加载所有目录的文件
      const filesEntries = await Promise.all(
        dirs.map(async dir => {
          const fr = await getFiles(dir.id);
          return [dir.id, fr.success ? fr.data : []];
        })
      );
      const filesMap = new Map(filesEntries);
      setTreeData(buildTree(dirs, filesMap, null));
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => { loadTree(); }, [loadTree]);

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
