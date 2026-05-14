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

/**
 * BUG FIX：删除行后重排样式坐标，避免删行后残留错位样式
 * @param {number} removedRow - 被删除的行索引
 * @param {number} amount     - 删除的行数（默认1）
 */
export const remapStylesAfterRowRemove = (removedRow, amount = 1) => {
  const keys = Object.keys(cellStyles);
  const toDelete = [];
  const toAdd = {};
  for (const key of keys) {
    const [r, c] = key.split('_').map(Number);
    if (r >= removedRow && r < removedRow + amount) {
      toDelete.push(key); // 删除被移走的行样式
    } else if (r >= removedRow + amount) {
      toDelete.push(key);
      toAdd[`${r - amount}_${c}`] = cellStyles[key]; // 后续行上移
    }
  }
  toDelete.forEach(k => delete cellStyles[k]);
  Object.assign(cellStyles, toAdd);
};

/**
 * BUG FIX：删除列后重排样式坐标
 * @param {number} removedCol - 被删除的列索引
 * @param {number} amount     - 删除的列数（默认1）
 */
export const remapStylesAfterColRemove = (removedCol, amount = 1) => {
  const keys = Object.keys(cellStyles);
  const toDelete = [];
  const toAdd = {};
  for (const key of keys) {
    const [r, c] = key.split('_').map(Number);
    if (c >= removedCol && c < removedCol + amount) {
      toDelete.push(key);
    } else if (c >= removedCol + amount) {
      toDelete.push(key);
      toAdd[`${r}_${c - amount}`] = cellStyles[key];
    }
  }
  toDelete.forEach(k => delete cellStyles[k]);
  Object.assign(cellStyles, toAdd);
};

/**
 * BUG FIX：插入行后重排样式坐标（插入点以下样式下移）
 * @param {number} insertedRow - 插入位置
 * @param {number} amount      - 插入的行数
 */
export const remapStylesAfterRowInsert = (insertedRow, amount = 1) => {
  const keys = Object.keys(cellStyles);
  const toDelete = [];
  const toAdd = {};
  for (const key of keys) {
    const [r, c] = key.split('_').map(Number);
    if (r >= insertedRow) {
      toDelete.push(key);
      toAdd[`${r + amount}_${c}`] = cellStyles[key];
    }
  }
  toDelete.forEach(k => delete cellStyles[k]);
  Object.assign(cellStyles, toAdd);
};

/**
 * BUG FIX：插入列后重排样式坐标
 */
export const remapStylesAfterColInsert = (insertedCol, amount = 1) => {
  const keys = Object.keys(cellStyles);
  const toDelete = [];
  const toAdd = {};
  for (const key of keys) {
    const [r, c] = key.split('_').map(Number);
    if (c >= insertedCol) {
      toDelete.push(key);
      toAdd[`${r}_${c + amount}`] = cellStyles[key];
    }
  }
  toDelete.forEach(k => delete cellStyles[k]);
  Object.assign(cellStyles, toAdd);
};
