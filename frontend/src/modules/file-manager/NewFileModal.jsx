import React, { useState } from 'react';

export default function NewFileModal({ directories, onClose, onConfirm }) {
  const [name, setName] = useState('');
  const [dirId, setDirId] = useState(directories[0]?.id || '');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('文件名不能为空'); return; }
    if (!dirId) { setError('请选择目录'); return; }
    await onConfirm(name.trim(), Number(dirId));
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.box}>
        <h3 style={styles.title}>新建文件</h3>
        <div style={styles.field}>
          <label style={styles.label}>所在目录</label>
          <select style={styles.select} value={dirId} onChange={e => setDirId(e.target.value)}>
            {directories.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>文件名称</label>
          <input
            style={styles.input}
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="请输入文件名称"
            autoFocus
          />
        </div>
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.btns}>
          <button style={styles.btnCancel} onClick={onClose}>取消</button>
          <button style={styles.btnOk} onClick={handleSubmit}>创建</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  box: { background:'#fff', borderRadius:10, padding:28, width:340, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' },
  title: { margin:'0 0 16px', fontSize:16, fontWeight:600, color:'#1E293B' },
  field: { marginBottom:12 },
  label: { display:'block', fontSize:12, color:'#64748B', marginBottom:4 },
  input: { width:'100%', padding:'8px 12px', border:'1px solid #CBD5E1', borderRadius:6, fontSize:14, outline:'none', boxSizing:'border-box' },
  select: { width:'100%', padding:'8px 12px', border:'1px solid #CBD5E1', borderRadius:6, fontSize:14, outline:'none', boxSizing:'border-box' },
  error: { color:'#DC2626', fontSize:12, marginTop:4 },
  btns: { display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 },
  btnCancel: { padding:'7px 18px', border:'1px solid #CBD5E1', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14 },
  btnOk: { padding:'7px 18px', border:'none', borderRadius:6, background:'#3B82F6', color:'#fff', cursor:'pointer', fontSize:14 },
};
