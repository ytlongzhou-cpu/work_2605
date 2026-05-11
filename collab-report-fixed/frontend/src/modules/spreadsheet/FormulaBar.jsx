/**
 * 模块D：表格编辑器 - 公式栏组件
 *
 * 显示当前选中单元格的坐标（Excel 格式，如 C3）和内容/公式。
 * 仅展示，不支持直接在公式栏编辑（编辑由 Handsontable 负责）。
 *
 * Props：
 *   row   {number|null} - 当前选中行（0-based）
 *   col   {number|null} - 当前选中列（0-based）
 *   value {string}      - 当前单元格内容或公式
 */

import React from 'react';

/**
 * 将列索引（0-based）转换为 Excel 列字母（与后端 auditController 保持一致）
 * @param {number} colIndex
 * @returns {string}
 */
function colIndexToLetter(colIndex) {
  let letter = '';
  let n = colIndex + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * 公式栏组件
 */
function FormulaBar({ row, col, value }) {
  // 坐标显示，如 A1、C3
  const cellRef =
    row !== null && col !== null
      ? `${colIndexToLetter(col)}${row + 1}`
      : '';

  return (
    <div style={styles.container}>
      {/* 单元格坐标框 */}
      <div style={styles.cellRefBox}>
        <span style={styles.cellRefText}>{cellRef}</span>
      </div>

      {/* 分隔线 */}
      <div style={styles.divider} />

      {/* fx 图标 */}
      <span style={styles.fxLabel}>fx</span>

      {/* 内容展示区 */}
      <div style={styles.valueBox}>
        <span style={styles.valueText}>{value ?? ''}</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display:     'flex',
    alignItems:  'center',
    height:      32,
    borderBottom: '1px solid #e0e0e0',
    background:  '#fafafa',
    padding:     '0 8px',
    gap:         8,
    flexShrink:  0,
  },
  cellRefBox: {
    minWidth:    60,
    textAlign:   'center',
    border:      '1px solid #d0d0d0',
    borderRadius: 2,
    padding:     '2px 6px',
    background:  '#fff',
  },
  cellRefText: {
    fontSize:    13,
    fontFamily:  'monospace',
    color:       '#333',
  },
  divider: {
    width:       1,
    height:      20,
    background:  '#d0d0d0',
  },
  fxLabel: {
    fontSize:    13,
    color:       '#888',
    fontStyle:   'italic',
    userSelect:  'none',
  },
  valueBox: {
    flex:        1,
    overflow:    'hidden',
    whiteSpace:  'nowrap',
    textOverflow: 'ellipsis',
  },
  valueText: {
    fontSize:    13,
    color:       '#222',
    fontFamily:  'monospace',
  },
};

export default FormulaBar;
