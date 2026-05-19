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
import { getFileById } from '../file-manager/fileApi';

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

  /** 当前文件名（用于导出文件命名） */
  const [fileName, setFileName] = useState('报表');

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
        const [sheetList, fileInfo] = await Promise.all([
          fetchSheets(fileId),
          getFileById(fileId),
        ]);
        setSheets(sheetList);
        if (fileInfo?.data?.name) setFileName(fileInfo.data.name);
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
        // BUG FIX：区分权限错误（403）和网络/其他错误，给出准确提示
        if (err.statusCode === 403) {
          setError('此报表为只读权限，不允许编辑');
        } else if (err.statusCode === 401) {
          setError('登录已过期，请重新登录');
        } else {
          setError('保存失败，请检查网络连接');
        }
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

  /**
   * 应用远端行列结构变更（模块E收到 row:deleted / col:deleted / row:inserted / col:inserted 后调用）
   * 直接操作 gridRef 内存数组，再触发 re-render
   * @param {'row:delete'|'col:delete'|'row:insert'|'col:insert'} type
   * @param {number} index  操作起始行/列索引（0-based）
   * @param {number} amount 行/列数量
   */
  const applyRemoteStructureChange = useCallback((type, index, amount = 1) => {
    const grid = gridRef.current;
    if (type === 'row:delete') {
      // 删除 [index, index+amount-1] 行
      grid.splice(index, amount);
    } else if (type === 'row:insert') {
      // 在 index 处插入 amount 个空行
      const colCount = grid[0]?.length || 26;
      const emptyRows = Array.from({ length: amount }, () => new Array(colCount).fill(null));
      grid.splice(index, 0, ...emptyRows);
    } else if (type === 'col:delete') {
      // 每行删除 [index, index+amount-1] 列
      for (const row of grid) {
        row.splice(index, amount);
      }
    } else if (type === 'col:insert') {
      // 每行在 index 处插入 amount 个空列
      for (const row of grid) {
        row.splice(index, 0, ...new Array(amount).fill(null));
      }
    }
    // 浅拷贝触发 React re-render
    setGridData([...grid]);
  }, []);

  // ── 组件卸载时清理定时器 ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    sheets,
    fileName,
    currentSheetId,
    setCurrentSheetId,
    gridData,
    loading,
    error,
    saveCell,
    applyRemoteChange,
    applyRemoteStructureChange,
  };
}
