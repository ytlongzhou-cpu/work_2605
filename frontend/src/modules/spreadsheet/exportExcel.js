/**
 * 模块D：表格导出工具
 *
 * 依赖：xlsx-js-style（支持单元格样式的 SheetJS 分支）
 *   安装：npm install xlsx-js-style
 *
 * 提供：
 *   exportGridToExcel  → .xlsx，完整保留字体/颜色/背景/对齐/边框
 *   exportGridToCSV    → .csv，UTF-8 BOM 防中文乱码（CSV 不支持样式）
 *
 * 文件名格式：{fileName}_{YYYYMMDDHHmm}.{ext}
 */

import XLSXStyle from 'xlsx-js-style';
import { getCellStyle } from './cellStyleStore';

// ─── 时间戳后缀 ───────────────────────────────────────
function timestamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join('');
}

// ─── CSS #RRGGBB → 'FFRRGGBB' ────────────────────────
function toArgb(css) {
  if (!css) return null;
  let hex = css.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 6) return 'FF' + hex.toUpperCase();
  return null;
}

// ─── CSS border → xlsx-js-style border 对象 ──────────
const BORDER_MAP = {
  '1px solid' : 'thin',
  '2px solid' : 'medium',
  '3px solid' : 'thick',
  '3px double': 'double',
  '1px dashed': 'dashed',
  '1px dotted': 'dotted',
};
function cssBorder(css) {
  if (!css) return null;
  const parts = css.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const style = BORDER_MAP[parts.slice(0, 2).join(' ')] || 'thin';
  const rgb   = toArgb(parts[2]) || 'FF000000';
  return { style, color: { rgb } };
}

// ─── cellStyleStore 样式 → xlsx-js-style s 对象 ──────
function buildStyle(s) {
  if (!s || !Object.keys(s).length) return null;
  const out = {};

  // 字体
  const font = {};
  if (s.bold)      font.bold      = true;
  if (s.italic)    font.italic    = true;
  if (s.underline) font.underline = true;
  const fc = toArgb(s.color);
  if (fc) font.color = { rgb: fc };
  if (Object.keys(font).length) out.font = font;

  // 填充（背景色）
  const bg = toArgb(s.background);
  if (bg) out.fill = { patternType: 'solid', fgColor: { rgb: bg } };

  // 对齐
  if (s.align) out.alignment = { horizontal: s.align, wrapText: false };

  // 边框
  const b = s.borders || {};
  const border = {};
  const t = cssBorder(b.top),    r = cssBorder(b.right),
        bt = cssBorder(b.bottom), l = cssBorder(b.left);
  if (t)  border.top    = t;
  if (r)  border.right  = r;
  if (bt) border.bottom = bt;
  if (l)  border.left   = l;
  if (Object.keys(border).length) out.border = border;

  return Object.keys(out).length ? out : null;
}

// ─── 把样式注入 worksheet 的每个单元格 ───────────────
function injectStyles(ws, rows) {
  for (let r = 0; r < rows.length; r++) {
    const cols = (rows[r] || []).length;
    for (let c = 0; c < cols; c++) {
      const style = buildStyle(getCellStyle(r, c));
      if (!style) continue;
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
      ws[addr].s = style;
    }
  }
}

// ─────────────────────────────────────────────────────
// 导出 Excel（.xlsx），带完整样式
// ─────────────────────────────────────────────────────
export function exportGridToExcel(gridData, fileName = '报表', sheetName = 'Sheet1') {
  const data = gridData || [];
  const ws   = XLSXStyle.utils.aoa_to_sheet(data);

  injectStyles(ws, data);

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);

  XLSXStyle.writeFile(wb, `${fileName}_${timestamp()}.xlsx`);
}

// ─────────────────────────────────────────────────────
// 导出 CSV（.csv），UTF-8 BOM（CSV 不支持样式，仅导出数据）
// ─────────────────────────────────────────────────────
export function exportGridToCSV(gridData, fileName = '报表') {
  const ws  = XLSXStyle.utils.aoa_to_sheet(gridData || []);
  const csv = XLSXStyle.utils.sheet_to_csv(ws);

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${fileName}_${timestamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
