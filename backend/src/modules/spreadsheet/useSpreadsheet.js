/**
 * 模块D：表格编辑器 - 数据加载与保存逻辑 Hook
 *
 * 职责：
 *   - 根据 fileId 加载 Sheet 列表
 *   - 根据 sheetId 加载单元格数据，转换为 Handsontable 所需的二维数组格式
 *   - 提供 saveCell / saveCellBatch 函数，节流保存到后端
 *   - 提供 applyRemoteChange，供模块E回调使用（远端更新直接写入表格数据）
 *
 * @param {number|null} fileId - 当前文件 ID
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSheets, fetchCells, saveCells } from './cellApi';
import { restoreStyles, clearCellStyles } from './cellStyleStore';

/** 默认表格行列数（空文件初始化大小） */
const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 26;

/**
 * 将后端返回的单元格数组转换为 Handsontable 所需的二维数组
 * @param {Array<{ row, col, value }>} cellList
 * @param {number} rows
 * @param {number} cols
 * @returns {Array<Array<string|null>>}
 */
function cellListToGrid(cellList, rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  // 初始化全 null 的二维数组
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (const { row, col, value } of cellList) {
    // 如果数据超出默认尺寸，动态扩展
    while (grid.length <= row) grid.push(Array(cols).fill(null));
    while (grid[row].length <= col) grid[row].push(null);
    grid[row][col] = value;
  }

  return grid;
}

/**
 * 表格数据管理 Hook
 * @param {number|null} fileId
 * @returns {{
 *   sheets: Array,
 *   currentSheetId: number|null,
 *   setCurrentSheetId: Function,
 *   gridData: Array<Array>,
 *   loading: boolean,
 *   error: string|null,
 *   saveCell: Function,
 *   applyRemoteChange: Function,
 * }}
 */
export function useSpreadsheet(fileId) {
  /** Sheet 列表 */
  const [sheets, setSheets] = useState([]);

  /** 当前选中的 Sheet ID */
  const [currentSheetId, setCurrentSheetId] = useState(null);

  /**
   * 表格二维数组数据（直接传给 Handsontable 的 data prop）
   * 注意：Handsontable 要求 data 是可变引用，此处使用 ref 持有最新值，
   * state 仅用于触发重渲染。
   */
  const [gridData, setGridData] = useState([]);
  const gridRef = useRef([]);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // ── 待保存队列（节流批量提交）──────────────────────────────────────
  /**
   * 待保存的单元格变更 Map，key 为 "row,col"，value 为最新 value
   * 500ms 内的变更合并为一次请求
   * @type {React.MutableRefObject<Map<string, { row, col, value }>>}
   */
  const pendingRef  = useRef(new Map());
  const timerRef    = useRef(null);
  // BUG FIX：用 ref 保存 currentSheetId，避免 saveCell 闭包持有旧值
  const currentSheetIdRef = useRef(null);

  // ── 加载 Sheet 列表 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!fileId) {
      setSheets([]);
      setCurrentSheetId(null);
      setGridData([]);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const sheetList = await fetchSheets(fileId);
        setSheets(sheetList);
        // 默认选中第一个 Sheet
        if (sheetList.length > 0) {
          setCurrentSheetId(sheetList[0].id);
        }
      } catch (err) {
        console.error('[useSpreadsheet] fetchSheets error:', err);
        setError('加载 Sheet 列表失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [fileId]);

  // ── 加载单元格数据 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentSheetId) {
      setGridData([]);
      gridRef.current = [];
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cellList = await fetchCells(currentSheetId);
        // 先清空旧样式，再从数据库恢复
        clearCellStyles();
        restoreStyles(cellList);
        const grid = cellListToGrid(cellList);
        gridRef.current = grid;
        setGridData(grid);
      } catch (err) {
        console.error('[useSpreadsheet] fetchCells error:', err);
        setError('加载单元格数据失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentSheetId]);

  // ── 保存逻辑（500ms 节流批量提交）────────────────────────────────────

  /**
   * 将单元格变更写入本地 grid + 加入待保存队列
   * Handsontable afterChange 回调中调用此函数
   * @param {number} row
   * @param {number} col
   * @param {string|null} value
   */
  const saveCell = useCallback((row, col, value) => {
    // 更新本地 grid（直接操作 ref，不触发 re-render，避免 Handsontable 闪烁）
    if (gridRef.current[row]) {
      gridRef.current[row][col] = value;
    }

    // 加入待保存队列（相同坐标的变更取最新值）
    pendingRef.current.set(`${row},${col}`, { row, col, value: value ?? '' });

    // 重置节流定时器
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // BUG FIX：使用 ref 读取 sheetId，避免旧闭包问题
      const sheetId = currentSheetIdRef.current;
      if (!sheetId || pendingRef.current.size === 0) return;

      const cells = Array.from(pendingRef.current.values());
      pendingRef.current.clear();

      try {
        await saveCells(sheetId, cells);
      } catch (err) {
        console.error('[useSpreadsheet] saveCells error:', err);
        // 保存失败时可在此触发 UI 提示（由使用方监听 error state）
        setError('保存失败，请检查网络连接');
      }
    }, 500);
  }, []); // BUG FIX：移除 currentSheetId 依赖，改用 ref

  // 同步 currentSheetId -> ref
  useEffect(() => { currentSheetIdRef.current = currentSheetId; }, [currentSheetId]);

  /**
   * 应用远端单元格变更（模块E收到 cell:updated 后调用）
   * 直接更新 gridRef + 触发 re-render
   * @param {number} row
   * @param {number} col
   * @param {string|null} value
   */
  const applyRemoteChange = useCallback((row, col, value) => {
    // 行不存在时自动扩展（远端用户可能操作了本地还没有的行）
    while (gridRef.current.length <= row) {
      gridRef.current.push(new Array(26).fill(null));
    }
    gridRef.current[row][col] = value ?? null;
    // 浅拷贝触发 React re-render，让 Handsontable 感知数据变化
    setGridData([...gridRef.current]);
  }, []);

  // ── 组件卸载时清理定时器 ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    sheets,
    currentSheetId,
    setCurrentSheetId,
    gridData,
    loading,
    error,
    saveCell,
    applyRemoteChange,
  };
}
