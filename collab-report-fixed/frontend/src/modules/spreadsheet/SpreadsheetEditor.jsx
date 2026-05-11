/**
 * 模块D：表格编辑器 - 核心组件 SpreadsheetEditor
 *
 * 功能：
 *   - 集成 Handsontable 14+ 渲染多行多列表格
 *   - 通过 useSpreadsheet Hook 完成数据加载、本地保存（500ms 节流）
 *   - 通过 useCollabContext（模块E）接收远端变更、广播本地变更与光标移动
 *   - 渲染 CursorOverlay 展示其他用户的实时光标
 *   - 渲染 FormulaBar 显示当前选中单元格内容
 *   - 渲染 SheetTabs 支持 Sheet 切换
 *
 * Props：
 *   fileId {number} - 当前打开的文件 ID（来自路由或父组件）
 *
 * 对外依赖：
 *   - 模块E CollabContext：useCollabContext()
 *   - 模块J cellApi：由 useSpreadsheet 内部调用
 *   - Handsontable 14+：npm install handsontable @handsontable/react
 *   - handsontable/dist/handsontable.full.min.css（在项目入口 index.jsx 引入）
 *
 * 注意：
 *   Handsontable 社区版（14+）对非商业项目免费，商业项目需购买许可证。
 *   许可证 key 通过环境变量 VITE_HANDSONTABLE_LICENSE 注入，非商业填 'non-commercial-and-evaluation'。
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
import CursorOverlay         from './CursorOverlay';
import FormulaBar            from './FormulaBar';
import SheetTabs             from './SheetTabs';

// 注册 Handsontable 全部内置模块（排序、过滤、合并单元格等）
registerAllModules();

/**
 * 表格编辑器主组件
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
    otherCursors,
    broadcastCellChange,
    broadcastCursorMove,
  } = useCollabContext();

  // ── Handsontable 实例 ref ────────────────────────────────────────────
  /** @type {React.RefObject<import('@handsontable/react').HotTableClass>} */
  const hotRef        = useRef(null);
  /** 表格外层容器 ref，供 CursorOverlay 计算相对偏移 */
  const containerRef  = useRef(null);

  // ── 公式栏状态 ────────────────────────────────────────────────────────
  const [selectedRow,   setSelectedRow]   = useState(null);
  const [selectedCol,   setSelectedCol]   = useState(null);
  const [selectedValue, setSelectedValue] = useState('');

  // ── 远端变更应用到 Handsontable ──────────────────────────────────────
  useEffect(() => {
    // applyRemoteChange 会更新 gridData，Handsontable 会自动感知
  }, [applyRemoteChange]);

  // ── Handsontable 回调：单元格变更 ────────────────────────────────────

  /**
   * afterChange：用户编辑完成后触发
   * changes: [[row, prop, oldVal, newVal], ...]
   * source:  变更来源（'edit' | 'paste' | ...），'loadData' 时跳过
   */
  const handleAfterChange = useCallback(
    (changes, source) => {
      if (!changes || source === 'loadData') return;

      for (const [row, col, , newVal] of changes) {
        const colIndex = typeof col === 'number' ? col : parseInt(col, 10);
        const value    = newVal ?? '';

        // 1. 本地保存（节流 500ms 后 PUT /api/cells）
        saveCell(row, colIndex, value);

        // 2. 广播给其他用户（模块E → Socket.io）
        broadcastCellChange(row, colIndex, value);
      }
    },
    [saveCell, broadcastCellChange]
  );

  /**
   * afterSelection：用户点击/键盘移动选区后触发
   * 更新公式栏 + 广播光标位置
   */
  const handleAfterSelection = useCallback(
    (row, col) => {
      // 更新公式栏
      const value = gridData?.[row]?.[col] ?? '';
      setSelectedRow(row);
      setSelectedCol(col);
      setSelectedValue(String(value));

      // 广播光标移动（模块E → Socket.io）
      broadcastCursorMove(row, col);
    },
    [gridData, broadcastCursorMove]
  );

  // ── 远端变更写入 Handsontable ─────────────────────────────────────────
  // 模块E收到 cell:updated 时调用 applyRemoteChange，
  // applyRemoteChange 更新 gridRef 并浅拷贝 gridData 触发重渲染，
  // Handsontable 通过 data prop 感知变化后自动刷新对应单元格。
  // 此处额外通过 hotRef 手动 setDataAtCell 确保立即生效（无需等 React re-render）。
  const stableApplyRemote = useCallback(
    (row, col, value) => {
      applyRemoteChange(row, col, value);
      // 直接操作 Handsontable 实例，绕过 React 渲染周期，实现即时更新
      const hot = hotRef.current?.hotInstance;
      if (hot) {
        hot.setDataAtCell(row, col, value ?? '', 'remote');
      }
    },
    [applyRemoteChange]
  );

  // 将稳定的 applyRemote 注入 CollabContext 通知链
  // CollabProvider 的 onRemoteCellChange prop 应传入此函数（见 App.jsx 接入说明）
  // 此处通过 useEffect 将最新引用同步给父组件持有的 ref
  const applyRemoteRef = useRef(stableApplyRemote);
  applyRemoteRef.current = stableApplyRemote;

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

      {/* 表格区域（相对定位，供 CursorOverlay 叠加） */}
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
          /* 远端更新来源标记为 'remote'，afterChange 内已跳过 */
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
