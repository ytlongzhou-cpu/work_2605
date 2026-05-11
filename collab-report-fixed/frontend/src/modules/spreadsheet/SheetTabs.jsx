/**
 * 模块D：表格编辑器 - Sheet 标签切换栏
 *
 * 渲染底部 Sheet 标签，支持点击切换当前 Sheet。
 *
 * Props：
 *   sheets          {Array<{ id, name }>} - Sheet 列表
 *   currentSheetId  {number|null}         - 当前选中 Sheet ID
 *   onSheetChange   {Function}            - (sheetId: number) => void
 */

import React from 'react';

/**
 * Sheet 标签切换栏组件
 */
function SheetTabs({ sheets = [], currentSheetId, onSheetChange }) {
  return (
    <div style={styles.container}>
      {sheets.map((sheet) => {
        const isActive = sheet.id === currentSheetId;
        return (
          <button
            key={sheet.id}
            style={{
              ...styles.tab,
              ...(isActive ? styles.tabActive : styles.tabInactive),
            }}
            onClick={() => !isActive && onSheetChange(sheet.id)}
            title={sheet.name}
          >
            {sheet.name}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  container: {
    display:         'flex',
    alignItems:      'flex-end',
    height:          32,
    background:      '#f0f0f0',
    borderTop:       '1px solid #d0d0d0',
    padding:         '0 8px',
    gap:             2,
    overflowX:       'auto',
    flexShrink:      0,
  },
  tab: {
    height:          28,
    padding:         '0 16px',
    border:          '1px solid #d0d0d0',
    borderBottom:    'none',
    borderRadius:    '3px 3px 0 0',
    cursor:          'pointer',
    fontSize:        13,
    whiteSpace:      'nowrap',
    maxWidth:        160,
    overflow:        'hidden',
    textOverflow:    'ellipsis',
    transition:      'background 0.15s',
  },
  tabActive: {
    background:      '#ffffff',
    color:           '#1a73e8',
    fontWeight:      600,
    borderColor:     '#bbb',
    zIndex:          1,
  },
  tabInactive: {
    background:      '#e8e8e8',
    color:           '#555',
  },
};

export default SheetTabs;
