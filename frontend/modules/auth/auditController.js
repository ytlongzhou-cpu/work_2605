/**
 * 模块M：审计日志 - 控制器
 *
 * 接口：
 *   GET /api/audit  查询审计日志（支持多维度筛选 + 分页）
 *
 * 返回字段说明：
 *   - cell_ref：单元格坐标转换为 Excel 格式（如 row=1, col=2 → C2）
 *   - display_name：操作人姓名（JOIN users 表获取）
 */

'use strict';

const { getPool, sql } = require('../../db');

// ─────────────────────────────────────────────
// 工具函数：将 0-based (row, col) 转换为 Excel 单元格坐标
// 例：row=0, col=0 → A1；row=1, col=2 → C2
// ─────────────────────────────────────────────

/**
 * 将列索引（0-based）转换为 Excel 列字母
 * @param {number} colIndex - 0-based 列索引
 * @returns {string} 列字母（A、B、...、Z、AA、AB...）
 */
function colIndexToLetter(colIndex) {
  let letter = '';
  let n = colIndex + 1; // 转为 1-based
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * 将 0-based (row, col) 转换为 Excel 单元格引用格式
 * @param {number} row - 0-based 行索引
 * @param {number} col - 0-based 列索引
 * @returns {string} Excel 格式坐标，如 "C2"
 */
function toCellRef(row, col) {
  return `${colIndexToLetter(col)}${row + 1}`;
}

// ─────────────────────────────────────────────
// GET /api/audit
// ─────────────────────────────────────────────

/**
 * 查询审计日志
 *
 * 查询参数（均可选）：
 *   sheet_id {number}  按 Sheet 筛选
 *   user_id  {number}  按操作人筛选
 *   from     {string}  起始时间（ISO 8601 日期字符串）
 *   to       {string}  截止时间（ISO 8601 日期字符串）
 *   page     {number}  页码（默认 1）
 *   limit    {number}  每页条数（默认 50，最大 200）
 *
 * 成功响应 200：
 * {
 *   success: true,
 *   data: [{
 *     id, sheet_id, cell_ref,
 *     row, col,
 *     old_value, new_value,
 *     changed_by, display_name,
 *     changed_at
 *   }, ...],
 *   total: number
 * }
 */
async function queryAuditLog(req, res) {
  // ── 解析查询参数 ──
  const sheetId = req.query.sheet_id ? parseInt(req.query.sheet_id, 10) : null;
  const fileId  = req.query.file_id  ? parseInt(req.query.file_id,  10) : null;
  const userId  = req.query.user_id  ? parseInt(req.query.user_id,  10) : null;
  const from    = req.query.from  || null;
  const to      = req.query.to    || null;
  const page    = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit   = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
  const offset  = (page - 1) * limit;

  // 参数合法性校验
  if (sheetId !== null && (isNaN(sheetId) || sheetId <= 0)) {
    return res.status(400).json({ success: false, error: '无效的 sheet_id', code: 400 });
  }
  if (fileId !== null && (isNaN(fileId) || fileId <= 0)) {
    return res.status(400).json({ success: false, error: '无效的 file_id', code: 400 });
  }
  if (userId !== null && (isNaN(userId) || userId <= 0)) {
    return res.status(400).json({ success: false, error: '无效的 user_id', code: 400 });
  }
  if (from && isNaN(Date.parse(from))) {
    return res.status(400).json({ success: false, error: 'from 时间格式无效', code: 400 });
  }
  if (to && isNaN(Date.parse(to))) {
    return res.status(400).json({ success: false, error: 'to 时间格式无效', code: 400 });
  }

  try {
    const pool = await getPool();
    const req2 = pool.request();

    // ── 动态构造 WHERE 子句 ──
    const conditions = [];
    // 当按 file_id 筛选时，JOIN sheets 表
    const needsSheetJoin = fileId !== null;

    if (sheetId !== null) {
      conditions.push('al.sheet_id = @sheetId');
      req2.input('sheetId', sql.Int, sheetId);
    }
    if (fileId !== null) {
      conditions.push('s.file_id = @fileId');
      req2.input('fileId', sql.Int, fileId);
    }
    if (userId !== null) {
      conditions.push('al.changed_by = @userId');
      req2.input('userId', sql.Int, userId);
    }
    if (from) {
      conditions.push('al.changed_at >= @from');
      req2.input('from', sql.DateTime2, new Date(from));
    }
    if (to) {
      // to 日期含当天，扩展到当天 23:59:59.999
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push('al.changed_at <= @to');
      req2.input('to', sql.DateTime2, toDate);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const sheetJoinClause = needsSheetJoin
      ? 'INNER JOIN sheets s ON s.id = al.sheet_id'
      : '';

    // ── 查询总数 ──
    const countResult = await req2.query(`
      SELECT COUNT(*) AS total
      FROM   cell_audit_log al
      ${sheetJoinClause}
      ${whereClause}
    `);
    const total = countResult.recordset[0].total;

    // ── 分页查询数据（JOIN users 表获取 display_name） ──
    // 需新建 request，因为同一 request 不能复用参数名
    const req3 = pool.request();

    if (sheetId !== null) req3.input('sheetId', sql.Int, sheetId);
    if (fileId  !== null) req3.input('fileId',  sql.Int, fileId);
    if (userId  !== null) req3.input('userId',  sql.Int, userId);
    if (from)             req3.input('from', sql.DateTime2, new Date(from));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      req3.input('to', sql.DateTime2, toDate);
    }
    req3.input('limit',  sql.Int, limit);
    req3.input('offset', sql.Int, offset);

    const dataResult = await req3.query(`
      SELECT
        al.id,
        al.sheet_id,
        al.row_index   AS [row],
        al.col_index   AS [col],
        al.old_value,
        al.new_value,
        al.changed_by,
        u.display_name,
        al.changed_at
      FROM   cell_audit_log al
      INNER  JOIN users u ON u.id = al.changed_by
      ${needsSheetJoin ? 'INNER JOIN sheets s ON s.id = al.sheet_id' : ''}
      ${whereClause}
      ORDER  BY al.changed_at DESC, al.id DESC
      OFFSET @offset ROWS
      FETCH  NEXT @limit ROWS ONLY
    `);

    // ── 格式化响应：补充 cell_ref 字段 ──
    const data = dataResult.recordset.map((item) => ({
      id:           item.id,
      sheet_id:     item.sheet_id,
      cell_ref:     toCellRef(item.row, item.col), // 如 "C2"
      row:          item.row,
      col:          item.col,
      old_value:    item.old_value,
      new_value:    item.new_value,
      changed_by:   item.changed_by,
      display_name: item.display_name,
      changed_at:   item.changed_at,
    }));

    return res.status(200).json({
      success: true,
      data,
      total,
    });
  } catch (err) {
    console.error('[auditController] queryAuditLog error:', err);
    return res.status(500).json({
      success: false,
      error: '查询审计日志失败',
      code: 500,
    });
  }
}

module.exports = { queryAuditLog };
