/**
 * 模块D：表格编辑器 - 公式栏组件（增强版）
 *
 * 升级：支持直接在公式栏编辑单元格内容
 *   - 点击内容区进入编辑模式
 *   - 回车 确认，Esc 取消，失焦自动确认
 *   - onValueChange 回调通知父组件更新 Handsontable
 *
 * Props：
 *   row            {number|null}
 *   col            {number|null}
 *   value          {string}
 *   onValueChange  {(v: string) => void}
 */

import React, { useState, useEffect, useRef } from 'react';

function colIndexToLetter(colIndex) {
  let letter = '', n = colIndex + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function FormulaBar({ row, col, value, onValueChange }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const inputRef              = useRef(null);

  useEffect(() => {
    setEditing(false);
    setDraft(value ?? '');
  }, [row, col, value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const cellRef = (row !== null && row !== undefined && col !== null && col !== undefined)
    ? `${colIndexToLetter(col)}${row + 1}` : '';

  const confirm = () => {
    setEditing(false);
    if (onValueChange && draft !== value) onValueChange(draft);
  };
  const cancel = () => { setEditing(false); setDraft(value ?? ''); };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel();  }
  };

  return (
    <div style={st.bar}>
      {/* 坐标框 */}
      <div style={st.ref}>
        <span style={st.refTxt}>{cellRef || '—'}</span>
      </div>
      <div style={st.div} />

      {/* fx */}
      <span style={st.fx}><i>f</i>x</span>
      <div style={st.div} />

      {/* 内容区 */}
      <div style={st.valueBox}>
        {editing ? (
          <input
            ref={inputRef}
            style={st.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={confirm}
            spellCheck={false}
          />
        ) : (
          <div style={st.display}
            onClick={() => { if (row !== null && row !== undefined) { setDraft(value ?? ''); setEditing(true); } }}
            title="点击编辑">
            <span style={st.valueTxt}>{value ?? ''}</span>
          </div>
        )}
      </div>

      {/* 编辑中按钮 */}
      {editing && (
        <div style={st.actions}>
          <button style={st.actBtn} title="取消 (Esc)"  onClick={cancel} >✕</button>
          <button style={{ ...st.actBtn, color:'#1a73e8' }} title="确认 (Enter)" onClick={confirm}>✓</button>
        </div>
      )}
    </div>
  );
}

const st = {
  bar:      { display:'flex', alignItems:'center', height:32, borderBottom:'1px solid #e0e0e0', background:'#fafafa', padding:'0 8px', gap:0, flexShrink:0 },
  ref:      { minWidth:62, textAlign:'center', border:'1px solid #d0d0d0', borderRadius:2, padding:'2px 6px', background:'#fff', marginRight:6 },
  refTxt:   { fontSize:13, fontFamily:'monospace', color:'#333' },
  div:      { width:1, height:20, background:'#d0d0d0', marginLeft:4, marginRight:6, flexShrink:0 },
  fx:       { fontSize:13, color:'#666', fontFamily:'serif', userSelect:'none', marginRight:4, letterSpacing:'-0.5px' },
  valueBox: { flex:1, display:'flex', alignItems:'center', overflow:'hidden', height:'100%' },
  display:  { flex:1, height:'100%', display:'flex', alignItems:'center', cursor:'text', padding:'0 4px', overflow:'hidden', whiteSpace:'nowrap' },
  valueTxt: { fontSize:13, color:'#222', fontFamily:'monospace', whiteSpace:'nowrap' },
  input:    { flex:1, height:24, border:'none', outline:'none', fontSize:13, fontFamily:'monospace', color:'#222', background:'transparent', padding:'0 4px', width:'100%' },
  actions:  { display:'flex', gap:2, marginLeft:4, flexShrink:0 },
  actBtn:   { width:22, height:22, border:'1px solid #d0d0d0', borderRadius:3, background:'#fff', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', color:'#666', padding:0, lineHeight:1 },
};

export default FormulaBar;
