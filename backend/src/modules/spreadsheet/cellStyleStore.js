/**
 * 单元格样式存储（模块级单例）
 * SpreadsheetEditor 和 useSpreadsheet 共用同一份样式数据
 */

const cellStyles = {};

export const getCellStyle  = (r, c) => cellStyles[`${r}_${c}`] || {};
export const setCellStyle  = (r, c, patch) => {
  cellStyles[`${r}_${c}`] = { ...getCellStyle(r, c), ...patch };
};
export const clearCellStyles = () => {
  Object.keys(cellStyles).forEach((k) => delete cellStyles[k]);
};
export const restoreStyles = (cellList) => {
  for (const { row, col, style } of cellList) {
    if (!style) continue;
    try {
      const s = typeof style === 'string' ? JSON.parse(style) : style;
      cellStyles[`${row}_${col}`] = s;
    } catch (_) { /* 忽略非法 JSON */ }
  }
};
