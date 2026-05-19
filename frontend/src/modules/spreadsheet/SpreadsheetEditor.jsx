/**
 * 模块D：表格编辑器 - 核心组件 SpreadsheetEditor
 *
 * 增强内容：
 *   1. 顶部工具栏：加粗/斜体/下划线/字体颜色/背景色/对齐/合并/边框/撤销重做
 *   2. 右键菜单完整汉化
 *   3. 单元格边框绘制（多种样式 + 颜色选择）
 *   4. 自定义单元格渲染器（通过 registerRenderer 正确注册）
 *
 * 关键修复：
 *   - 渲染器用 Handsontable.renderers.registerRenderer 注册，名字为 'styledText'
 *   - HotTable 通过 cells={() => ({ renderer: 'styledText' })} 引用渲染器
 *   - Handsontable 从 'handsontable/base' 显式 import，避免全局变量访问失败
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';

import { getCellStyle, setCellStyle, clearCellStyles,
         remapStylesAfterRowRemove, remapStylesAfterColRemove,
         remapStylesAfterRowInsert, remapStylesAfterColInsert } from './cellStyleStore';
import { useSpreadsheet }  from './useSpreadsheet';
import { saveStyles, deleteRowsApi, deleteColsApi, insertRowsApi, insertColsApi } from './cellApi';
import { useCollabContext } from '../collaboration/CollabContext';
import { useLayout } from '../layout/AppLayout';
import CursorOverlay       from './CursorOverlay';
import FormulaBar          from './FormulaBar';
import SheetTabs           from './SheetTabs';
import { exportGridToExcel, exportGridToCSV } from './exportExcel';

registerAllModules();


// ─────────────────────────────────────────────────────────────────────────────
// 注册自定义渲染器（模块加载时只执行一次）
// ─────────────────────────────────────────────────────────────────────────────
Handsontable.renderers.registerRenderer(
  'styledText',
  function (hotInstance, TD, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.call(this, hotInstance, TD, row, col, prop, value, cellProperties);
    const s = getCellStyle(row, col);
    TD.style.fontWeight      = s.bold       ? 'bold'      : '';
    TD.style.fontStyle       = s.italic     ? 'italic'    : '';
    TD.style.textDecoration  = s.underline  ? 'underline' : '';
    TD.style.color           = s.color      || '';
    TD.style.backgroundColor = s.background || '';
    TD.style.textAlign       = s.align      || '';
    const b = s.borders || {};
    TD.style.borderTop    = b.top    || '';
    TD.style.borderRight  = b.right  || '';
    TD.style.borderBottom = b.bottom || '';
    TD.style.borderLeft   = b.left   || '';
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 右键菜单（中文）
// ─────────────────────────────────────────────────────────────────────────────
const CTX_MENU = {
  items: {
    row_above:       { name: '在上方插入行' },
    row_below:       { name: '在下方插入行' },
    col_left:        { name: '在左侧插入列' },
    col_right:       { name: '在右侧插入列' },
    remove_row:      { name: '删除行' },
    remove_col:      { name: '删除列' },
    sep1:            Handsontable.plugins.ContextMenu.SEPARATOR,
    undo:            { name: '撤销 (Ctrl+Z)' },
    redo:            { name: '重做 (Ctrl+Y)' },
    sep2:            Handsontable.plugins.ContextMenu.SEPARATOR,
    copy:            { name: '复制 (Ctrl+C)' },
    cut:             { name: '剪切 (Ctrl+X)' },
    sep3:            Handsontable.plugins.ContextMenu.SEPARATOR,
    mergeCells:      { name: '合并 / 拆分单元格' },
    sep4:            Handsontable.plugins.ContextMenu.SEPARATOR,
    alignment: {
      name: '文字对齐方式',
      submenu: {
        items: [
          { key: 'alignment:left',    name: '⬅  左对齐'   },
          { key: 'alignment:center',  name: '⬌  居中'     },
          { key: 'alignment:right',   name: '➡  右对齐'   },
          { key: 'alignment:justify', name: '☰  两端对齐' },
        ],
      },
    },
    freeze_column:   { name: '冻结此列' },
    unfreeze_column: { name: '取消冻结列' },
    sep5:            Handsontable.plugins.ContextMenu.SEPARATOR,
    clear_column:    { name: '清空此列' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 颜色面板
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = [
  '#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#ffffff',
  '#ff0000','#ff4500','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff',
  '#9900ff','#ff00ff','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6fa8dc',
  '#8e7cc3','#c27ba0','#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3d85c8',
  '#674ea7','#a64d79','#990000','#b45f06','#bf9000','#38761d','#134f5c','#1155cc',
];

function ColorPicker({ title, onSelect, onClose }) {
  return (
    <div style={cpSt.panel}>
      <div style={cpSt.title}>{title}</div>
      <div style={cpSt.grid}>
        {PALETTE.map((c) => (
          <div key={c} style={{ ...cpSt.dot, background: c }} title={c}
            onClick={() => { onSelect(c); onClose(); }} />
        ))}
      </div>
    </div>
  );
}
const cpSt = {
  panel: { position:'absolute', top:'100%', left:0, zIndex:9999, background:'#fff', border:'1px solid #d0d0d0', borderRadius:4, boxShadow:'0 4px 12px rgba(0,0,0,0.18)', padding:8, width:196 },
  title: { fontSize:11, color:'#666', marginBottom:6, fontWeight:500 },
  grid:  { display:'flex', flexWrap:'wrap', gap:2 },
  dot:   { width:18, height:18, borderRadius:2, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)' },
};

// ─────────────────────────────────────────────────────────────────────────────
// 边框面板
// ─────────────────────────────────────────────────────────────────────────────
const BORDER_PRESETS = [
  { label:'所有边框', value:'all',    icon:'⊞' },
  { label:'外部边框', value:'outer',  icon:'□' },
  { label:'内部边框', value:'inner',  icon:'⊟' },
  { label:'上边框',   value:'top',    icon:'⊤' },
  { label:'下边框',   value:'bottom', icon:'⊥' },
  { label:'左边框',   value:'left',   icon:'⊣' },
  { label:'右边框',   value:'right',  icon:'⊢' },
  { label:'无边框',   value:'none',   icon:'✕' },
];
const BORDER_LINE_STYLES = [
  { label:'细实线', value:'1px solid'  },
  { label:'中实线', value:'2px solid'  },
  { label:'粗实线', value:'3px solid'  },
  { label:'虚线',   value:'1px dashed' },
  { label:'点线',   value:'1px dotted' },
  { label:'双线',   value:'3px double' },
];

function BorderPanel({ onApply, onClose }) {
  const [ls, setLs] = useState('1px solid');
  const [lc, setLc] = useState('#000000');
  const [showCP, setShowCP] = useState(false);
  return (
    <div style={bpSt.panel}>
      <div style={bpSt.row}>
        <span style={bpSt.label}>线条样式</span>
        <select style={bpSt.select} value={ls} onChange={(e) => setLs(e.target.value)}>
          {BORDER_LINE_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div style={bpSt.row}>
        <span style={bpSt.label}>线条颜色</span>
        <div style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:6 }}>
          <div style={{ ...bpSt.colorDot, background: lc }} onClick={() => setShowCP((v) => !v)} />
          <span style={{ fontSize:11, color:'#555' }}>{lc}</span>
          {showCP && (
            <div style={{ position:'absolute', top:'100%', left:0, zIndex:10000 }}>
              <ColorPicker title="选择颜色" onSelect={(c) => { setLc(c); setShowCP(false); }} onClose={() => setShowCP(false)} />
            </div>
          )}
        </div>
      </div>
      <div style={bpSt.divider} />
      <div style={bpSt.label}>边框位置</div>
      <div style={bpSt.grid}>
        {BORDER_PRESETS.map((p) => (
          <button key={p.value} style={bpSt.btn} title={p.label}
            onClick={() => { onApply(p.value, `${ls} ${lc}`); onClose(); }}>
            <span style={{ fontSize:15 }}>{p.icon}</span>
            <span style={{ fontSize:10, marginTop:1 }}>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
const bpSt = {
  panel:    { position:'absolute', top:'100%', left:0, zIndex:9999, background:'#fff', border:'1px solid #d0d0d0', borderRadius:4, boxShadow:'0 4px 12px rgba(0,0,0,0.18)', padding:10, width:224 },
  row:      { display:'flex', alignItems:'center', gap:8, marginBottom:8 },
  label:    { fontSize:11, color:'#666', fontWeight:500, flexShrink:0 },
  select:   { flex:1, fontSize:12, padding:'3px 4px', border:'1px solid #d0d0d0', borderRadius:3, background:'#fff' },
  colorDot: { width:20, height:20, borderRadius:3, cursor:'pointer', border:'1px solid #bbb', flexShrink:0 },
  divider:  { borderTop:'1px solid #eee', margin:'6px 0 8px' },
  grid:     { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 },
  btn:      { display:'flex', flexDirection:'column', alignItems:'center', padding:'5px 2px', border:'1px solid #e0e0e0', borderRadius:3, background:'#fafafa', cursor:'pointer', gap:2 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 工具栏组件
// ─────────────────────────────────────────────────────────────────────────────
const ICONS = {
  bold:      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2h4.5a3 3 0 0 1 2.1 5.1A3.2 3.2 0 0 1 8.8 14H4V2zm2 5h2.5a1 1 0 1 0 0-2H6v2zm0 5h2.8a1.2 1.2 0 1 0 0-2.4H6V12z" fill="currentColor"/></svg>,
  italic:    <svg viewBox="0 0 16 16" width="14" height="14"><path d="M7 2h5v2H9.8L7.2 12H9v2H4v-2h2.2L8.8 4H7V2z" fill="currentColor"/></svg>,
  uline:     <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2h2v6a2 2 0 0 0 4 0V2h2v6a4 4 0 0 1-8 0V2zM3 13h10v1H3z" fill="currentColor"/></svg>,
  aL:        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 3h12v1.5H2zm0 3h8v1.5H2zm0 3h12v1.5H2zm0 3h8v1.5H2z" fill="currentColor"/></svg>,
  aC:        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 3h12v1.5H2zm2 3h8v1.5H4zm-2 3h12v1.5H2zm2 3h8v1.5H4z" fill="currentColor"/></svg>,
  aR:        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 3h12v1.5H2zm4 3h8v1.5H6zm-4 3h12v1.5H2zm4 3h8v1.5H6z" fill="currentColor"/></svg>,
  merge:     <svg viewBox="0 0 16 16" width="14" height="14"><path d="M1 2h14v12H1V2zm1.5 1.5v9h11v-9h-11zM8 5l3 3-3 3V9H5V7h3V5z" fill="currentColor"/></svg>,
  undo:      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4.5 5H9a3.5 3.5 0 0 1 0 7H5v-1.5h4a2 2 0 1 0 0-4H4.5l2 2-1.1 1.1L2 6.5 5.4 3 6.5 4.1l-2 2z" fill="currentColor"/></svg>,
  redo:      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M11.5 5H7a3.5 3.5 0 0 0 0 7h4v-1.5H7a2 2 0 1 1 0-4h4.5l-2 2 1.1 1.1L14 6.5 10.6 3 9.5 4.1l2 2z" fill="currentColor"/></svg>,
  border:    <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v1H5V5zm0 3h6v1H5V8zm-2 3h10v1H3v-1z" fill="currentColor"/></svg>,
  fClr:      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M7 2h2l3.5 9h-2L9.5 9h-3L5.5 11h-2L7 2zm.5 2.5L6.3 7.5h2.4L7.5 4.5z" fill="currentColor"/></svg>,
  bClr:      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M10.5 1.5l4 4-6 6H4v-4.5l6.5-5.5zm-1.1 1.9L4 8.5V11h2.5l5.4-5.4-2.5-2.2zM1 14h14v1H1v-1z" fill="currentColor"/></svg>,
  cut:       <svg viewBox="0 0 16 16" width="14" height="14"><path d="M9.5 3h5.5v2H11v9H5V5H3V3h6.5zM6 5v9h4V5H6zm6 0v2h3.5V5H12z" fill="currentColor"/></svg>,
  copy:      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M5 3h6v2H5V3zm10 0v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2zm-2 0a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3z" fill="currentColor"/></svg>,
  paste:     <svg viewBox="0 0 16 16" width="14" height="14"><path d="M5 3h6v2H5V3zm3 6h6v2H8V9zm0 4h6v2H8v-2zM3 3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3zm2-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H5z" fill="currentColor"/></svg>,
  insertRow: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 6h12v1H2V6zm0 4h9v1H2v-1zm0 4h9v1H2v-1zM15 4a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4zm-1 1v1h-2V5h2zM15 12a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h4zm-1 1v1h-2v-1h2zM15 8a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h4zm-1 1v1h-2V9h2z" fill="currentColor"/></svg>,
  deleteRow: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 6h12v1H2V6zm0 4h12v1H2v-1zm3-7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1H5V3zm1 1v10a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4H6zM9 6v4H8V6h1zm2 0v4h-1V6h1z" fill="currentColor"/></svg>,
  insertCol: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M6 2h1v12H6V2zm4 0h1v12h-1V2zm-7 3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 1v-1h-1v1h1zm9 6a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1zm1 1v-1h-1v1h1zM2 11a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1zm1 1v-1h-1v1h1zm12-6a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1zm1 1v-1h-1v1h1z" fill="currentColor"/></svg>,
  deleteCol:  <svg viewBox="0 0 16 16" width="14" height="14"><path d="M6 2h1v12H6V2zm4 0h1v12h-1V2zM3 5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5zm1 1v4h2V6H4zm3 0v4h2V6H7z" fill="currentColor"/></svg>,
  exportXlsx: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M9 1v4h4l-4-4zM3 1h5l4 4v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm1 7.5 1.5 2 1.5-2h1.2l-2.1 3 2.1 3H7l-1.5-2-1.5 2H2.8l2.1-3-2.1-3H4z" fill="currentColor"/></svg>,
  exportCsv:  <svg viewBox="0 0 16 16" width="14" height="14"><path d="M9 1v4h4l-4-4zM3 1h5l4 4v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm2 6H4v3.5c0 .83.67 1.5 1.5 1.5S7 11.33 7 10.5H6c0 .28-.22.5-.5.5S5 10.78 5 10.5V9h2V8H5V7zm2.5 0c-.83 0-1.5.67-1.5 1.5v2c0 .83.67 1.5 1.5 1.5S9 11.33 9 10.5v-2C9 7.67 8.33 7 7.5 7zm0 1c.28 0 .5.22.5.5v2a.5.5 0 0 1-1 0v-2c0-.28.22-.5.5-.5zm2-.5v4h2.5v-1H11V7.5h-1z" fill="currentColor"/></svg>,
};

// ─────────────────────────────────────────────────────────────────────────────
// 导出面板
// ─────────────────────────────────────────────────────────────────────────────
function ExportPanel({ onExcel, onCsv, onClose }) {
  return (
    <div style={epSt.panel}>
      <div style={epSt.title}>导出文件</div>
      <button style={epSt.item} onClick={() => { onExcel(); onClose(); }}>
        <span style={epSt.itemIcon}>📊</span>
        <div>
          <div style={epSt.itemLabel}>Excel 格式（.xlsx）</div>
          <div style={epSt.itemDesc}>可用 Excel / WPS 打开</div>
        </div>
      </button>
      <button style={epSt.item} onClick={() => { onCsv(); onClose(); }}>
        <span style={epSt.itemIcon}>📄</span>
        <div>
          <div style={epSt.itemLabel}>CSV 格式（.csv）</div>
          <div style={epSt.itemDesc}>纯文本，兼容所有表格软件</div>
        </div>
      </button>
    </div>
  );
}
const epSt = {
  panel:    { position:'absolute', top:'100%', right:0, zIndex:9999, background:'#fff', border:'1px solid #d0d0d0', borderRadius:6, boxShadow:'0 4px 16px rgba(0,0,0,0.15)', padding:'8px 0', width:220, marginTop:2 },
  title:    { fontSize:11, color:'#999', fontWeight:600, padding:'2px 12px 6px', borderBottom:'1px solid #f0f0f0', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' },
  item:     { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 12px', border:'none', background:'transparent', cursor:'pointer', textAlign:'left', transition:'background 0.12s' },
  itemIcon: { fontSize:20, flexShrink:0 },
  itemLabel:{ fontSize:13, color:'#222', fontWeight:500, marginBottom:1 },
  itemDesc: { fontSize:11, color:'#888' },
};

function TBtn({ icon, title, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button title={title}
      style={{ ...tbSt.btn, ...(active ? tbSt.active : {}), ...(hov ? tbSt.hov : {}) }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={onClick}>
      {icon}
    </button>
  );
}
function TSep() { return <div style={tbSt.sep} />; }
function CBtn({ icon, title, color, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button title={title}
      style={{ ...tbSt.btn, flexDirection:'column', gap:1, padding:'2px 3px', ...(hov ? tbSt.hov : {}) }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={onClick}>
      {icon}
      <div style={{ width:14, height:3, borderRadius:1, background: color, flexShrink:0 }} />
    </button>
  );
}
const tbSt = {
  btn: { display:'flex', alignItems:'center', justifyContent:'center', width:28, height:26, border:'none', borderRadius:3, background:'transparent', cursor:'pointer', color:'#3c3c3c', padding:0, transition:'background 0.1s', flexShrink:0 },
  active: { background:'#d0e4ff', color:'#1a73e8' },
  hov:    { background:'#f0f0f0' },
  sep:    { width:1, height:18, background:'#e0e0e0', margin:'0 4px', flexShrink:0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────────────────────────────────────
function SpreadsheetEditor({ fileId }) {
  const { sheets, fileName, currentSheetId, setCurrentSheetId, gridData, loading, error, saveCell, applyRemoteChange, applyRemoteStructureChange } = useSpreadsheet(fileId);

  // BUG FIX：用 ref 跟踪 currentSheetId，供 afterRemoveRow/Col 等回调（空依赖数组）安全读取
  const sheetIdRef = useRef(currentSheetId);
  useEffect(() => { sheetIdRef.current = currentSheetId; }, [currentSheetId]);
  const { otherCursors, broadcastCellChange, broadcastCursorMove, broadcastStyleChange, setCollabSheet } = useCollabContext();
  const { setSyncStatus } = useLayout();

  const hotRef      = useRef(null);
  const containerRef= useRef(null);
  const selRef      = useRef({ r1:0, c1:0, r2:0, c2:0 });

  const [selRow, setSelRow] = useState(null);
  const [selCol, setSelCol] = useState(null);
  const [selVal, setSelVal] = useState('');

  const [fmt,  setFmt]  = useState({ bold:false, italic:false, underline:false, align:'' });
  const [fClr, setFClr] = useState('#000000');
  const [bClr, setBClr] = useState('#ffff00');
  const [panel, setPanel] = useState(null); // 'fc'|'bc'|'br'|null

  const alterStructure = useCallback((type, index, amount = 1, source) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || index === null || index === undefined || index < 0) return false;

    const actionMap = {
      'row:delete': 'remove_row',
      'col:delete': 'remove_col',
      'row:insert': 'insert_row_above',
      'col:insert': 'insert_col_start',
    };
    const action = actionMap[type];
    if (!action) return false;

    hot.alter(action, index, amount, source);
    hot.render();
    return true;
  }, []);


  // 协作层绑定（注意：不在此处调用 clearCellStyles，样式清理由 useSpreadsheet 的 fetchCells 负责）
  useEffect(() => {
    setCollabSheet(
      currentSheetId,
      // 远端单元格值变更回调：直接调 Handsontable API 立刻渲染，同时更新 gridRef
      (row, col, value) => {
        applyRemoteChange(row, col, value);
        const hot = hotRef.current?.hotInstance;
        if (hot) {
          hot.setDataAtCell(row, col, value ?? '', 'remote');
        }
      },
      // 远端样式变更回调
      (cells) => {
        cells.forEach(({ row, col, style }) => {
          if (style) {
            const s = typeof style === 'string' ? JSON.parse(style) : style;
            setCellStyle(row, col, s);
          }
        });
        hotRef.current?.hotInstance?.render();
      },
      // 远端行列结构变更回调（由 useCollaboration 触发）
      (type, index, amount) => {
        // 1. 同步更新 cellStyleStore 坐标映射
        if      (type === 'row:delete') remapStylesAfterRowRemove(index, amount);
        else if (type === 'col:delete') remapStylesAfterColRemove(index, amount);
        else if (type === 'row:insert') remapStylesAfterRowInsert(index, amount);
        else if (type === 'col:insert') remapStylesAfterColInsert(index, amount);
        // 2. 通知 Handsontable 执行结构变更（source 标记为 'remote' 避免触发广播再广播）
        if (!alterStructure(type, index, amount, 'remote')) {
          applyRemoteStructureChange(type, index, amount);
        }
      }
    );
  }, [currentSheetId, applyRemoteChange, applyRemoteStructureChange, alterStructure]); // 移除 setCollabSheet 依赖，避免 Context re-render 导致 effect 重跑清空样式

  const getSelCells = useCallback(() => {
    const { r1,c1,r2,c2 } = selRef.current;
    const cells = [];
    for (let r=Math.min(r1,r2); r<=Math.max(r1,r2); r++)
      for (let c=Math.min(c1,c2); c<=Math.max(c1,c2); c++)
        cells.push([r,c]);
    return cells;
  }, []);

  const rerender = useCallback(() => { hotRef.current?.hotInstance?.render(); }, []);
  const closePanel = useCallback(() => setPanel(null), []);

  // 样式应用 + 广播 + HTTP 持久化（三合一）
  const applyAndSaveStyle = useCallback((selCells) => {
    const payload = selCells.map(([r, c]) => ({ row: r, col: c, style: getCellStyle(r, c) }));
    broadcastStyleChange(payload);
    // HTTP 持久化（不依赖 socket 是否在线）
    if (currentSheetId) {
      saveStyles(currentSheetId, payload).catch(err =>
        console.error('[SpreadsheetEditor] saveStyles error:', err)
      );
    }
  }, [broadcastStyleChange, currentSheetId]);

  const toggleFmt = useCallback((key) => {
    const next = !fmt[key];
    const cells = getSelCells();
    cells.forEach(([r,c]) => setCellStyle(r, c, { [key]: next }));
    setFmt((p) => ({ ...p, [key]: next }));
    applyAndSaveStyle(cells);
    rerender();
  }, [fmt, getSelCells, rerender, applyAndSaveStyle]);

  const applyAlign = useCallback((align) => {
    const cells = getSelCells();
    cells.forEach(([r,c]) => setCellStyle(r, c, { align }));
    setFmt((p) => ({ ...p, align }));
    applyAndSaveStyle(cells);
    rerender();
  }, [getSelCells, rerender, applyAndSaveStyle]);

  const applyFontColor = useCallback((color) => {
    setFClr(color);
    const cells = getSelCells();
    cells.forEach(([r,c]) => setCellStyle(r, c, { color }));
    applyAndSaveStyle(cells);
    rerender();
  }, [getSelCells, rerender, applyAndSaveStyle]);

  const applyBgColor = useCallback((color) => {
    setBClr(color);
    const cells = getSelCells();
    cells.forEach(([r,c]) => setCellStyle(r, c, { background: color }));
    applyAndSaveStyle(cells);
    rerender();
  }, [getSelCells, rerender, applyAndSaveStyle]);

  const applyBorder = useCallback((position, borderVal) => {
    const cells = getSelCells();
    const { r1,c1,r2,c2 } = selRef.current;
    const minR=Math.min(r1,r2), maxR=Math.max(r1,r2), minC=Math.min(c1,c2), maxC=Math.max(c1,c2);
    cells.forEach(([r,c]) => {
      const isT=r===minR, isB=r===maxR, isL=c===minC, isR=c===maxC;
      const borders = { ...getCellStyle(r,c).borders };
      if      (position==='none')  { borders.top=borders.right=borders.bottom=borders.left=''; }
      else if (position==='all')   { borders.top=borders.right=borders.bottom=borders.left=borderVal; }
      else if (position==='outer') { if(isT) borders.top=borderVal; if(isB) borders.bottom=borderVal; if(isL) borders.left=borderVal; if(isR) borders.right=borderVal; }
      else if (position==='inner') { if(!isT) borders.top=borderVal; if(!isB) borders.bottom=borderVal; if(!isL) borders.left=borderVal; if(!isR) borders.right=borderVal; }
      else if (position==='top'    && isT) borders.top=borderVal;
      else if (position==='bottom' && isB) borders.bottom=borderVal;
      else if (position==='left'   && isL) borders.left=borderVal;
      else if (position==='right'  && isR) borders.right=borderVal;
      setCellStyle(r, c, { borders });
    });
    applyAndSaveStyle(cells);
    rerender();
  }, [getSelCells, rerender, applyAndSaveStyle]);

  const toggleMerge = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    const plugin = hot.getPlugin('mergeCells');
    const { r1,c1,r2,c2 } = selRef.current;
    if (r1===r2 && c1===c2) return;
    if (plugin.mergedCellsCollection.get(r1,c1)) plugin.unmerge(r1,c1,r2,c2);
    else plugin.merge(r1,c1,r2,c2);
    hot.render();
  }, []);

  const doUndo = useCallback(() => hotRef.current?.hotInstance?.undo(), []);
  const doRedo = useCallback(() => hotRef.current?.hotInstance?.redo(), []);

  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData' || source === 'remote') return;
    setSyncStatus('syncing');
    for (const [row, col, , newVal] of changes) {
      const r = Number(row);
      const c = Number(col);
      const v = newVal ?? '';
      saveCell(r, c, v);
      broadcastCellChange(r, c, v);
    }
    setTimeout(() => setSyncStatus('synced'), 700);
  }, [saveCell, broadcastCellChange, setSyncStatus]);

  // BUG FIX：删除行/列后重排 cellStyleStore 坐标，并持久化到 DB（否则切表后恢复原状）
  const handleAfterRemoveRow = useCallback((index, amount, _, source) => {
    // source === 'remote' 时是收到远端广播后由 onRemoteStructureChangeRef 触发的，不再二次广播
    if (source === 'remote') return;
    remapStylesAfterRowRemove(index, amount);
    hotRef.current?.hotInstance?.render();
    // 持久化：删 DB 对应行，后续行 row_index 上移
    const sid = sheetIdRef.current;
    if (sid) deleteRowsApi(sid, index, amount).catch(err => console.error('[deleteRows]', err));
  }, []);

  const handleAfterRemoveCol = useCallback((index, amount, _, source) => {
    if (source === 'remote') return;
    remapStylesAfterColRemove(index, amount);
    hotRef.current?.hotInstance?.render();
    const sid = sheetIdRef.current;
    if (sid) deleteColsApi(sid, index, amount).catch(err => console.error('[deleteCols]', err));
  }, []);

  const handleAfterCreateRow = useCallback((index, amount, source) => {
    if (source === 'remote') return;
    remapStylesAfterRowInsert(index, amount);
    hotRef.current?.hotInstance?.render();
    // 持久化：DB 中 >= index 的行 row_index 下移，为新行腾位置
    const sid = sheetIdRef.current;
    if (sid) insertRowsApi(sid, index, amount).catch(err => console.error('[insertRows]', err));
  }, []);

  const handleAfterCreateCol = useCallback((index, amount, source) => {
    if (source === 'remote') return;
    remapStylesAfterColInsert(index, amount);
    hotRef.current?.hotInstance?.render();
    const sid = sheetIdRef.current;
    if (sid) insertColsApi(sid, index, amount).catch(err => console.error('[insertCols]', err));
  }, []);

  const handleAfterSelection = useCallback((row, col, row2, col2) => {
    selRef.current = { r1:row, c1:col, r2:row2??row, c2:col2??col };
    setSelRow(row); setSelCol(col);
    setSelVal(String(gridData?.[row]?.[col] ?? ''));
    broadcastCursorMove(row, col);
    const s = getCellStyle(row, col);
    setFmt({ bold:!!s.bold, italic:!!s.italic, underline:!!s.underline, align:s.align||'' });
    if (s.color)      setFClr(s.color);
    if (s.background) setBClr(s.background);
  }, [gridData, broadcastCursorMove]);

  if (loading) return <div style={st.center}><span style={{ color:'#888', fontSize:15 }}>加载中…</span></div>;
  if (error)   return <div style={st.center}><span style={{ color:'#d32f2f', fontSize:15 }}>{error}</span></div>;

  return (
    <div style={st.root} onClick={closePanel}>

      {/* 工具栏 */}
      <div style={st.toolbar} onClick={(e) => e.stopPropagation()}>
        {/* 撤销/重做 */}
        <TBtn icon={ICONS.undo}  title="撤销 (Ctrl+Z)" onClick={doUndo} />
        <TBtn icon={ICONS.redo}  title="重做 (Ctrl+Y)" onClick={doRedo} />
        <TSep />

        {/* 剪切/复制/粘贴 */}
        <TBtn icon={ICONS.cut}   title="剪切 (Ctrl+X)" onClick={() => hotRef.current?.hotInstance?.cut()} />
        <TBtn icon={ICONS.copy}  title="复制 (Ctrl+C)" onClick={() => hotRef.current?.hotInstance?.copy()} />
        <TBtn icon={ICONS.paste} title="粘贴 (Ctrl+V)" onClick={() => hotRef.current?.hotInstance?.paste()} />
        <TSep />

        {/* 插入/删除行列 */}
        <TBtn icon={ICONS.insertRow} title="插入行"    onClick={() => alterStructure('row:insert', selRef.current.r1, 1)} />
        <TBtn icon={ICONS.deleteRow} title="删除行"    onClick={() => alterStructure('row:delete', selRef.current.r1, 1)} />
        <TBtn icon={ICONS.insertCol} title="插入列"    onClick={() => alterStructure('col:insert', selRef.current.c1, 1)} />
        <TBtn icon={ICONS.deleteCol} title="删除列"    onClick={() => alterStructure('col:delete', selRef.current.c1, 1)} />
        <TSep />

        {/* 字体样式 */}
        <TBtn icon={ICONS.bold}   title="加粗"   active={fmt.bold}      onClick={() => toggleFmt('bold')} />
        <TBtn icon={ICONS.italic} title="斜体"   active={fmt.italic}    onClick={() => toggleFmt('italic')} />
        <TBtn icon={ICONS.uline}  title="下划线" active={fmt.underline} onClick={() => toggleFmt('underline')} />
        <TSep />

        {/* 字体颜色 */}
        <div style={{ position:'relative' }}>
          <CBtn icon={ICONS.fClr} title="字体颜色" color={fClr} onClick={() => setPanel(panel==='fc' ? null : 'fc')} />
          {panel==='fc' && <ColorPicker title="字体颜色" onSelect={applyFontColor} onClose={closePanel} />}
        </div>

        {/* 背景色 */}
        <div style={{ position:'relative' }}>
          <CBtn icon={ICONS.bClr} title="填充颜色" color={bClr} onClick={() => setPanel(panel==='bc' ? null : 'bc')} />
          {panel==='bc' && <ColorPicker title="填充颜色" onSelect={applyBgColor} onClose={closePanel} />}
        </div>
        <TSep />

        {/* 对齐方式 */}
        <TBtn icon={ICONS.aL} title="左对齐" active={fmt.align==='left'}   onClick={() => applyAlign('left')} />
        <TBtn icon={ICONS.aC} title="居中"   active={fmt.align==='center'} onClick={() => applyAlign('center')} />
        <TBtn icon={ICONS.aR} title="右对齐" active={fmt.align==='right'}  onClick={() => applyAlign('right')} />
        <TSep />

        {/* 合并单元格 */}
        <TBtn icon={ICONS.merge} title="合并 / 拆分单元格" onClick={toggleMerge} />
        <TSep />

        {/* 边框 */}
        <div style={{ position:'relative' }}>
          <TBtn icon={ICONS.border} title="单元格边框" active={panel==='br'} onClick={() => setPanel(panel==='br' ? null : 'br')} />
          {panel==='br' && <BorderPanel onApply={applyBorder} onClose={closePanel} />}
        </div>
        <TSep />

        {/* 导出 */}
        <div style={{ position:'relative' }}>
          <button
            title="导出文件"
            style={{ ...tbSt.btn, gap:3, padding:'0 6px', width:'auto', fontSize:12, color: panel==='ex' ? '#1a73e8' : '#3c3c3c', background: panel==='ex' ? '#d0e4ff' : 'transparent' }}
            onClick={() => setPanel(panel==='ex' ? null : 'ex')}
          >
            {ICONS.exportXlsx}
            <span style={{ fontSize:12, fontWeight:500, lineHeight:1 }}>导出</span>
            <svg viewBox="0 0 10 6" width="8" height="8" style={{ marginLeft:1, opacity:0.6 }}><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg>
          </button>
          {panel==='ex' && (
            <ExportPanel
              onExcel={() => {
                const sheetName = sheets.find(s => s.id === currentSheetId)?.name || 'Sheet1';
                exportGridToExcel(gridData, fileName, sheetName);
              }}
              onCsv={() => exportGridToCSV(gridData, fileName)}
              onClose={closePanel}
            />
          )}
        </div>
      </div>

      {/* 公式栏 */}
      <FormulaBar
        row={selRow} col={selCol} value={selVal}
        onValueChange={(v) => {
          setSelVal(v);
          const hot = hotRef.current?.hotInstance;
          if (hot && selRow !== null) hot.setDataAtCell(selRow, selCol, v);
        }}
      />

      {/* 表格 */}
      <div ref={containerRef} style={st.table}>
        <HotTable
          ref={hotRef}
          data={gridData}
          rowHeaders={true}
          colHeaders={true}
          licenseKey={import.meta.env.VITE_HANDSONTABLE_LICENSE || 'non-commercial-and-evaluation'}
          width="100%"
          height="100%"
          stretchH="all"
          manualColumnResize={true}
          manualRowResize={true}
          contextMenu={CTX_MENU}
          copyPaste={true}
          undo={true}
          mergeCells={true}
          cells={() => ({ renderer: 'styledText' })}
          afterChange={handleAfterChange}
          afterSelection={handleAfterSelection}
          afterRemoveRow={handleAfterRemoveRow}
          afterRemoveCol={handleAfterRemoveCol}
          afterCreateRow={handleAfterCreateRow}
          afterCreateCol={handleAfterCreateCol}
        />
        <CursorOverlay hotRef={hotRef} containerRef={containerRef} otherCursors={otherCursors} />
      </div>

      {/* Sheet 标签栏 */}
      <SheetTabs sheets={sheets} currentSheetId={currentSheetId} onSheetChange={setCurrentSheetId} />
    </div>
  );
}

const st = {
  root:   { display:'flex', flexDirection:'column', width:'100%', height:'100%', overflow:'hidden', background:'#fff' },
  toolbar:{ display:'flex', alignItems:'center', height:36, padding:'0 8px', gap:2, background:'#f8f8f8', borderBottom:'1px solid #e0e0e0', flexShrink:0, overflowX:'visible', overflowY:'visible', position:'relative', zIndex:200 },
  table:  { flex:1, position:'relative', overflow:'hidden' },
  center: { display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%' },
};

export default SpreadsheetEditor;
