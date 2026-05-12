/**
 * 模块D：表格编辑器 - 核心组件 SpreadsheetEditor
 *
 * BUG FIX 列表：
 *   1. 未调用 setCollabSheet，导致协作层无法感知当前 sheetId 和远端回调
 *   2. afterChange 未过滤 source==='remote' 导致远端更新无限循环广播
 *   3. afterChange 中 col 可能为字符串（paste/autofill），需强制转 Number
 *   4. applyRemoteChange 通过 hot.setDataAtCell 更新时 source 未标记 'remote'，
 *      导致 afterChange 再次触发广播（配合 BUG FIX 2 一起解决）
 */

import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
} from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';

import { useSpreadsheet }   from './useSpreadsheet';
import { useCollabContext }  from '../collaboration/CollabContext';
import { useLayout }         from '../layout/AppLayout';
import CursorOverlay         from './CursorOverlay';
import FormulaBar            from './FormulaBar';
import SheetTabs             from './SheetTabs';

// 注册 Handsontable 全部内置模块
registerAllModules();

/**
 * @param {{ fileId: number }} props
 */
function SpreadsheetEditor({ fileId }) {
  // ── 数据层 ──────────────────────────────────────────────────────────
  const {
    sheets,
    currentSheetId,
    setCurrentSheetId,
    gridData,
    loading,
    error,
    saveCell,
    applyRemoteChange,
  } = useSpreadsheet(fileId);

  // ── 协作层（模块E） ──────────────────────────────────────────────────
  const {
    onlineUsers,
    otherCursors,
    broadcastCellChange,
    broadcastCursorMove,
    setCollabSheet,   // BUG FIX 1：从 Context 取出 setCollabSheet
  } = useCollabContext();

  // ── 布局层：同步在线用户到 TopBar，同步 syncStatus 到 StatusBar ──
  const { setOnlineUsers, setSyncStatus } = useLayout();

  // ── Handsontable 实例 ref ────────────────────────────────────────────
  const hotRef        = useRef(null);
  const containerRef  = useRef(null);

  // ── 公式栏状态 ────────────────────────────────────────────────────────
  const [selectedRow,   setSelectedRow]   = useState(null);
  const [selectedCol,   setSelectedCol]   = useState(null);
  const [selectedValue, setSelectedValue] = useState('');

  // ── BUG FIX 1：currentSheetId 变化时，通知协作层绑定新 Sheet ────────
  useEffect(() => {
    setCollabSheet(currentSheetId, (row, col, value) => {
      // 远端变更：更新 gridData
      applyRemoteChange(row, col, value);
      // 直接操作 HOT 实例立即刷新，来源标记 'remote'（BUG FIX 4）
      const hot = hotRef.current?.hotInstance;
      if (hot) {
        hot.setDataAtCell(row, col, value ?? '', 'remote');
      }
    });
  }, [currentSheetId, setCollabSheet, applyRemoteChange]);

  // ── BUG FIX：将协作层的在线用户列表同步给 TopBar ──────────────────
  useEffect(() => {
    setOnlineUsers(onlineUsers);
  }, [onlineUsers, setOnlineUsers]);

  // ── Handsontable 回调：单元格变更 ────────────────────────────────────
  const handleAfterChange = useCallback(
    (changes, source) => {
      // BUG FIX 2：跳过初始加载和远端变更来源，避免无限循环
      if (!changes || source === 'loadData' || source === 'remote') return;

      // BUG FIX：有本地变更时报告 saving 状态
      setSyncStatus('syncing');

      for (const [row, col, , newVal] of changes) {
        // BUG FIX 3：col 在 paste/autofill 场景下可能为字符串
        const colIndex = Number(col);
        const value    = newVal ?? '';

        // 1. 本地保存（节流 500ms 后 PUT /api/cells）
        saveCell(row, colIndex, value);

        // 2. 广播给其他用户
        broadcastCellChange(row, colIndex, value);
      }

      // BUG FIX：保存完成后（节流 500ms 后）更新为 synced
      // 使用与 saveCell 相同的 500ms 延迟估算
      setTimeout(() => setSyncStatus('synced'), 700);
    },
    [saveCell, broadcastCellChange, setSyncStatus]
  );

  /**
   * afterSelection：更新公式栏 + 广播光标
   */
  const handleAfterSelection = useCallback(
    (row, col) => {
      const value = gridData?.[row]?.[col] ?? '';
      setSelectedRow(row);
      setSelectedCol(col);
      setSelectedValue(String(value));
      broadcastCursorMove(row, col);
    },
    [gridData, broadcastCursorMove]
  );

  // ── 渲染 ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.centered}>
        <span style={styles.loadingText}>加载中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centered}>
        <span style={styles.errorText}>{error}</span>
      </div>
    );
  }

  return (
    <div style={styles.editorRoot}>
      {/* 公式栏 */}
      <FormulaBar
        row={selectedRow}
        col={selectedCol}
        value={selectedValue}
      />

      {/* 表格区域 */}
      <div ref={containerRef} style={styles.tableContainer}>
        <HotTable
          ref={hotRef}
          data={gridData}
          rowHeaders={true}
          colHeaders={true}
          licenseKey={
            import.meta.env.VITE_HANDSONTABLE_LICENSE ||
            'non-commercial-and-evaluation'
          }
          width="100%"
          height="100%"
          stretchH="all"
          manualColumnResize={true}
          manualRowResize={true}
          contextMenu={true}
          copyPaste={true}
          undo={true}
          afterChange={handleAfterChange}
          afterSelection={handleAfterSelection}
        />

        {/* 其他用户光标浮层 */}
        <CursorOverlay
          hotRef={hotRef}
          containerRef={containerRef}
          otherCursors={otherCursors}
        />
      </div>

      {/* Sheet 标签栏 */}
      <SheetTabs
        sheets={sheets}
        currentSheetId={currentSheetId}
        onSheetChange={setCurrentSheetId}
      />
    </div>
  );
}

const styles = {
  editorRoot: {
    display:        'flex',
    flexDirection:  'column',
    width:          '100%',
    height:         '100%',
    overflow:       'hidden',
    background:     '#fff',
  },
  tableContainer: {
    flex:           1,
    position:       'relative',
    overflow:       'hidden',
  },
  centered: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
    height:         '100%',
  },
  loadingText: {
    color:          '#888',
    fontSize:       15,
  },
  errorText: {
    color:          '#d32f2f',
    fontSize:       15,
  },
};

export default SpreadsheetEditor;
