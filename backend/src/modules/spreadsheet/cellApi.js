/**
 * 模块D：表格编辑器 - 单元格 API 调用函数
 *
 * 封装模块J后端接口的前端调用，供 useSpreadsheet Hook 使用。
 * Axios 实例已由模块A配置自动附加 Bearer Token，直接导入使用。
 *
 * 依赖：
 *   - axiosInstance  来自模块A：src/modules/auth/authApi.js 或 src/api/axios.js
 *     （根据模块A实际导出路径调整 import）
 */

import axiosInstance from '../auth/axiosInstance';

/**
 * 获取文件的所有 Sheet 列表
 * @param {number} fileId
 * @returns {Promise<Array<{ id: number, name: string, sort_order: number }>>}
 */
export async function fetchSheets(fileId) {
  const res = await axiosInstance.get(`/api/sheets/${fileId}`);
  return res.data.data;
}

/**
 * 获取指定 Sheet 所有非空单元格数据
 * @param {number} sheetId
 * @returns {Promise<Array<{ row: number, col: number, value: string }>>}
 */
export async function fetchCells(sheetId) {
  const res = await axiosInstance.get(`/api/cells/${sheetId}`);
  return res.data.data;
}

/**
 * 批量 upsert 单元格（对应 PUT /api/cells/:sheetId）
 * @param {number} sheetId
 * @param {Array<{ row: number, col: number, value: string }>} cells
 * @returns {Promise<void>}
 */
export async function saveCells(sheetId, cells) {
  await axiosInstance.put(`/api/cells/${sheetId}`, { cells });
}

/**
 * 批量保存单元格样式（对应 PUT /api/cells/:sheetId/styles）
 * @param {number} sheetId
 * @param {Array<{ row: number, col: number, style: object }>} cells
 * @returns {Promise<void>}
 */
export async function saveStyles(sheetId, cells) {
  await axiosInstance.put(`/api/cells/${sheetId}/styles`, { cells });
}
