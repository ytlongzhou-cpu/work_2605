import React, { useState } from 'react';
import { createDirectory, createFile } from './fileApi';

export default function FileTreeItem({ node, onFileSelect, onReload, currentUser, selectedFileId, onDirSelect }) {
  const [expanded, setExpanded] = useState(true);
  const isAdmin = currentUser?.role === 'admin';
  const isFile = !node.children; // 文件没有 children 字段

  if (isFile) {
    // 渲染文件行
    const isSelected = selectedFileId === node.id;
    return (
      <div
        onClick={() => onFileSelect(node.id)}
        style={{
          ...styles.fileRow,
          background: isSelected ? '#DBEAFE' : 'transparent',
          color: isSelected ? '#1D4ED8' : '#374151',
        }}
        title={node.name}
      >
        <span style={styles.fileIcon}>📄</span>
        <span style={styles.fileName}>{node.name}</span>
        {node.is_archived && <span style={styles.archivedTag}>归档</span>}
      </div>
    );
  }

  // 渲染目录行
  return (
    <div>
      <div
        style={styles.dirRow}
        onClick={() => { setExpanded(e => !e); onDirSelect && onDirSelect(node.id); }}
      >
        <span style={styles.arrow}>{expanded ? '▾' : '▸'}</span>
        <span style={styles.dirIcon}>📁</span>
        <span style={styles.dirName}>{node.name}</span>
        {node.is_archived && <span style={styles.archivedTag}>归档</span>}
        {isAdmin && (
          <span style={styles.inlineActions} onClick={e => e.stopPropagation()}>
            <button style={styles.inlineBtn} title="在此目录下新建子目录"
              onClick={async () => {
                const name = window.prompt('子目录名称：');
                if (!name) return;
                const res = await createDirectory(name, node.id);
                if (!res.success) alert(res.error);
                else onReload();
              }}>+目录</button>
            <button style={styles.inlineBtn} title="在此目录下新建文件"
              onClick={async () => {
                const name = window.prompt('文件名称：');
                if (!name) return;
                const res = await createFile(name, node.id);
                if (!res.success) alert(res.error);
                else onReload();
              }}>+文件</button>
          </span>
        )}
      </div>
      {expanded && node.children && node.children.map(child => (
        <div key={child.id} style={{ paddingLeft: 14 }}>
          <FileTreeItem
            node={child}
            onFileSelect={onFileSelect}
            onReload={onReload}
            currentUser={currentUser}
            selectedFileId={selectedFileId}
            onDirSelect={onDirSelect}
          />
        </div>
      ))}
    </div>
  );
}

const styles = {
  dirRow: { display:'flex', alignItems:'center', padding:'4px 8px', cursor:'pointer', borderRadius:4, userSelect:'none', gap:4, ':hover':{ background:'#F1F5F9' } },
  fileRow: { display:'flex', alignItems:'center', padding:'4px 8px 4px 22px', cursor:'pointer', borderRadius:4, gap:4, userSelect:'none' },
  arrow: { fontSize:10, color:'#94A3B8', width:12, flexShrink:0 },
  dirIcon: { fontSize:14, flexShrink:0 },
  fileIcon: { fontSize:13, flexShrink:0 },
  dirName: { fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#374151' },
  fileName: { fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  archivedTag: { fontSize:10, color:'#94A3B8', background:'#F1F5F9', borderRadius:3, padding:'1px 4px', flexShrink:0 },
  inlineActions: { display:'flex', gap:2, flexShrink:0 },
  inlineBtn: { fontSize:10, padding:'1px 5px', border:'1px solid #CBD5E1', borderRadius:3, background:'#fff', cursor:'pointer', color:'#64748B' },
};
