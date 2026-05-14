/**
 * 模块D：表格编辑器 - Sheet 标签切换栏（增强版）
 *
 * 升级：激活标签顶部蓝色指示线，悬停效果更流畅，与工具栏风格统一
 *
 * Props：
 *   sheets          {Array<{ id, name }>}
 *   currentSheetId  {number|null}
 *   onSheetChange   {Function}
 */

import React, { useState } from 'react';

function SheetTabs({ sheets = [], currentSheetId, onSheetChange }) {
  const [hovId, setHovId] = useState(null);

  return (
    <div style={st.bar}>
      {sheets.map((sheet) => {
        const active = sheet.id === currentSheetId;
        const hov    = sheet.id === hovId && !active;
        return (
          <button
            key={sheet.id}
            style={{ ...st.tab, ...(active ? st.active : hov ? st.hov : {}) }}
            onClick={() => !active && onSheetChange(sheet.id)}
            onMouseEnter={() => setHovId(sheet.id)}
            onMouseLeave={() => setHovId(null)}
            title={sheet.name}
          >
            {active && <div style={st.indicator} />}
            <span style={st.label}>{sheet.name}</span>
          </button>
        );
      })}
    </div>
  );
}

const st = {
  bar: {
    display:'flex', alignItems:'stretch', height:32,
    background:'#f0f0f0', borderTop:'1px solid #d0d0d0',
    padding:'0 0 0 8px', overflowX:'auto', flexShrink:0,
    scrollbarWidth:'none',
  },
  tab: {
    position:'relative', height:'100%', minWidth:60,
    padding:'0 16px', border:'none', borderRight:'1px solid #d8d8d8',
    cursor:'pointer', fontSize:12.5, whiteSpace:'nowrap',
    maxWidth:160, overflow:'hidden', background:'transparent',
    color:'#555', transition:'background 0.12s, color 0.12s',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  active: { background:'#ffffff', color:'#1a73e8', fontWeight:600 },
  hov:    { background:'#e4e4e4', color:'#333' },
  indicator: {
    position:'absolute', top:0, left:8, right:8, height:2,
    background:'#1a73e8', borderRadius:'0 0 2px 2px',
  },
  label: { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
};

export default SheetTabs;
