import React from 'react';
import FileTreeItem from './FileTreeItem';
import { useFileTree } from './useFileTree';

export default function FileTree({ onFileSelect }) {
  const { treeData, loading, currentUser, reload } = useFileTree();

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      {treeData.map(node => (
        <FileTreeItem key={node.id} node={node} onFileSelect={onFileSelect} onReload={reload} currentUser={currentUser} />
      ))}
    </div>
  );
}
