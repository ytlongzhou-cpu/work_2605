/**
 * 模块J：单元格读写 - 控制器
 *
 * 接口：
 *   GET  /api/sheets/:fileId   获取文件的所有 Sheet 列表
 *   GET  /api/cells/:sheetId   获取 Sheet 所有非空单元格数据
 *   PUT  /api/cells/:sheetId   批量 upsert 单元格，同步写审计日志
 *
 * 依赖：
 *   - db        数据库连接池，来自 backend/db.js（见 README）
 *   - writeAuditLog  来自模块M：backend/modules/audit/auditWriter.js
 */

'use strict';

const { getPool, sql } = require('../../db');
const { writeAuditLog } = require('../auth/auditWriter');

// ─────────────────────────────────────────────
// GET /api/sheets/:fileId
// ─────────────────────────────────────────────

/**
 * 获取指定文件的所有 Sheet 列表
 *
 * 路由参数：
 *   fileId {number} - files 表主键
 *
 * 成功响应 200：
 *   { success: true, data: [{ id, name, sort_order }, ...] }
 */
async function getSheetsByFileId(req, res) {
  const fileId = parseInt(req.params.fileId, 10);

  // 参数校验
  if (isNaN(fileId) || fileId <= 0) {
    return res.status(400).json({
      success: false,
      error: '无效的 fileId',
      code: 400,
    });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('fileId', sql.Int, fileId)
      .query(`
        SELECT id, name, sort_order
        FROM   sheets
        WHERE  file_id = @fileId
        ORDER  BY sort_order ASC, id ASC
      `);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('[cellsController] getSheetsByFileId error:', err);
    return res.status(500).json({
      success: false,
      error: '获取 Sheet 列表失败',
      code: 500,
    });
  }
}

// ─────────────────────────────────────────────
// GET /api/cells/:sheetId
// ─────────────────────────────────────────────

/**
 * 获取指定 Sheet 内所有非空单元格数据
 * 只返回 value 不为 NULL 的行，空单元格不传输以减少数据量
 *
 * 路由参数：
 *   sheetId {number} - sheets 表主键
 *
 * 成功响应 200：
 *   { success: true, data: [{ row, col, value }, ...] }
 */
async function getCellsBySheetId(req, res) {
  const sheetId = parseInt(req.params.sheetId, 10);

  if (isNaN(sheetId) || sheetId <= 0) {
    return res.status(400).json({
      success: false,
      error: '无效的 sheetId',
      code: 400,
    });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sheetId', sql.Int, sheetId)
      .query(`
        SELECT row_index AS [row],
               col_index AS [col],
               value,
               style
        FROM   cells
        WHERE  sheet_id = @sheetId
          AND  (value IS NOT NULL OR style IS NOT NULL)
        ORDER  BY row_index ASC, col_index ASC
      `);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('[cellsController] getCellsBySheetId error:', err);
    return res.status(500).json({
      success: false,
      error: '获取单元格数据失败',
      code: 500,
    });
  }
}

// ─────────────────────────────────────────────
// PUT /api/cells/:sheetId
// ─────────────────────────────────────────────

/**
 * 批量 upsert 单元格，并为每个被修改的单元格写入审计日志
 *
 * 路由参数：
 *   sheetId {number} - sheets 表主键
 *
 * 请求体：
 *   { cells: [{ row: number, col: number, value: string }, ...] }
 *   - cells 数组长度限制 1~500，防止单次请求过大
 *   - value 为 null 或空字符串时，写入 NULL（清空单元格）
 *
 * 成功响应 200：
 *   { success: true }
 *
 * 实现说明：
 *   1. 先批量查询本次涉及的单元格旧值，用于写审计日志
 *   2. 逐条执行 SQL Server MERGE（upsert），保证 UNIQUE 约束不冲突
 *   3. 写入审计日志（调用模块M的 writeAuditLog）
 *   全部操作在同一个数据库事务中完成，任意步骤失败则整体回滚
 */
async function upsertCells(req, res) {
  const sheetId = parseInt(req.params.sheetId, 10);

  if (isNaN(sheetId) || sheetId <= 0) {
    return res.status(400).json({
      success: false,
      error: '无效的 sheetId',
      code: 400,
    });
  }

  // ── 请求体校验 ──
  const { cells } = req.body;

  if (!Array.isArray(cells) || cells.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'cells 字段必须为非空数组',
      code: 400,
    });
  }

  if (cells.length > 500) {
    return res.status(400).json({
      success: false,
      error: '单次最多提交 500 个单元格',
      code: 400,
    });
  }

  // 校验每个单元格字段合法性
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (
      typeof c.row !== 'number' || c.row < 0 ||
      typeof c.col !== 'number' || c.col < 0
    ) {
      return res.status(400).json({
        success: false,
        error: `cells[${i}] 的 row/col 必须为非负整数`,
        code: 400,
      });
    }
  }

  // 当前操作用户（由 authenticateToken 中间件注入）
  const userId = req.user.id;

  const pool = await getPool();
  // 开启事务，保证 upsert + 审计日志的原子性
  const transaction = pool.transaction();

  try {
    await transaction.begin();
    const request = transaction.request();

    // ── Step 1：批量查询旧值，用于审计日志 ──
    // 构造 IN 条件匹配 (row_index, col_index) 组合
    // SQL Server 不支持行值构造器 IN，改用 LEFT JOIN + 临时值
    // 此处用逐条查询旧值的方式，确保兼容 SQL Server 2016
    const oldValueMap = new Map(); // key: "row,col"

    for (const cell of cells) {
      const oldResult = await transaction
        .request()
        .input('sheetId_ov', sql.Int, sheetId)
        .input('row_ov', sql.Int, cell.row)
        .input('col_ov', sql.Int, cell.col)
        .query(`
          SELECT value
          FROM   cells
          WHERE  sheet_id  = @sheetId_ov
            AND  row_index = @row_ov
            AND  col_index = @col_ov
        `);

      const oldVal =
        oldResult.recordset.length > 0
          ? oldResult.recordset[0].value
          : null;

      oldValueMap.set(`${cell.row},${cell.col}`, oldVal);
    }

    // ── Step 2：逐条执行 MERGE（upsert） ──
    for (const cell of cells) {
      const cellValue =
        cell.value === null || cell.value === undefined || cell.value === ''
          ? null
          : String(cell.value);

      // style 字段：JSON 字符串或 null
      const cellStyle =
        cell.style !== undefined && cell.style !== null
          ? (typeof cell.style === 'string' ? cell.style : JSON.stringify(cell.style))
          : undefined; // undefined 表示本次不更新 style

      // 根据是否传入 style 决定 SQL
      const styleClause = cellStyle !== undefined
        ? ', style = source.style'
        : '';
      const styleInsertCol = cellStyle !== undefined ? ', style' : '';
      const styleInsertVal = cellStyle !== undefined ? ', source.style' : '';

      await transaction
        .request()
        .input('sheetId_m', sql.Int, sheetId)
        .input('row_m', sql.Int, cell.row)
        .input('col_m', sql.Int, cell.col)
        .input('value_m', sql.NVarChar(sql.MAX), cellValue)
        .input('style_m', sql.NVarChar(sql.MAX), cellStyle !== undefined ? cellStyle : null)
        .input('userId_m', sql.Int, userId)
        .query(`
          MERGE cells AS target
          USING (VALUES (@sheetId_m, @row_m, @col_m, @value_m, @style_m, @userId_m))
                AS source(sheet_id, row_index, col_index, value, style, updated_by)
          ON    target.sheet_id  = source.sheet_id
            AND target.row_index = source.row_index
            AND target.col_index = source.col_index
          WHEN MATCHED THEN
            UPDATE SET
              value      = source.value,
              style      = CASE WHEN @style_m IS NOT NULL THEN source.style ELSE target.style END,
              updated_by = source.updated_by,
              updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (sheet_id, row_index, col_index, value, style, updated_by)
            VALUES (source.sheet_id, source.row_index, source.col_index,
                    source.value, source.style, source.updated_by);
        `);
    }

    // ── Step 3：批量写入审计日志 ──
    for (const cell of cells) {
      const oldVal = oldValueMap.get(`${cell.row},${cell.col}`);
      const newVal =
        cell.value === null || cell.value === undefined || cell.value === ''
          ? null
          : String(cell.value);

      // 仅当值发生变化时才写日志，避免无意义的审计记录
      if (oldVal !== newVal) {
        await writeAuditLog(
          { transaction }, // 传入当前事务，保证原子性
          sheetId,
          cell.row,
          cell.col,
          oldVal,
          newVal,
          userId
        );
      }
    }

    await transaction.commit();

    return res.status(200).json({ success: true });
  } catch (err) {
    // 事务回滚
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      console.error('[cellsController] rollback error:', rollbackErr);
    }
    console.error('[cellsController] upsertCells error:', err);
    return res.status(500).json({
      success: false,
      error: '保存单元格失败',
      code: 500,
    });
  }
}

module.exports = {
  getSheetsByFileId,
  getCellsBySheetId,
  upsertCells,
};

// ── upsertCellsCore（从 cellsController_patch.js 合并）──
async function upsertCellsCore(sheetId, cells, userId) {
  if (!Array.isArray(cells) || cells.length === 0) return;
  const pool = await getPool();
  const transaction = pool.transaction();
  try {
    await transaction.begin();
    const oldValueMap = new Map();
    for (const cell of cells) {
      const r = await transaction.request()
        .input('sheetId_ov', sql.Int, sheetId)
        .input('row_ov', sql.Int, cell.row)
        .input('col_ov', sql.Int, cell.col)
        .query('SELECT value FROM cells WHERE sheet_id=@sheetId_ov AND row_index=@row_ov AND col_index=@col_ov');
      oldValueMap.set(`${cell.row},${cell.col}`, r.recordset[0]?.value ?? null);
    }
    for (const cell of cells) {
      const cellValue = (cell.value === null || cell.value === undefined || cell.value === '') ? null : String(cell.value);
      await transaction.request()
        .input('sheetId_m', sql.Int, sheetId)
        .input('row_m', sql.Int, cell.row)
        .input('col_m', sql.Int, cell.col)
        .input('value_m', sql.NVarChar(sql.MAX), cellValue)
        .input('userId_m', sql.Int, userId)
        .query(`
          MERGE cells AS target
          USING (VALUES (@sheetId_m,@row_m,@col_m,@value_m,@userId_m))
                AS source(sheet_id,row_index,col_index,value,updated_by)
          ON target.sheet_id=source.sheet_id AND target.row_index=source.row_index AND target.col_index=source.col_index
          WHEN MATCHED THEN UPDATE SET value=source.value,updated_by=source.updated_by,updated_at=GETDATE()
          WHEN NOT MATCHED THEN INSERT (sheet_id,row_index,col_index,value,updated_by)
            VALUES (source.sheet_id,source.row_index,source.col_index,source.value,source.updated_by);
        `);
    }
    for (const cell of cells) {
      const oldVal = oldValueMap.get(`${cell.row},${cell.col}`);
      const newVal = (cell.value === null || cell.value === undefined || cell.value === '') ? null : String(cell.value);
      if (oldVal !== newVal) {
        await writeAuditLog({ transaction }, sheetId, cell.row, cell.col, oldVal, newVal, userId);
      }
    }
    await transaction.commit();
  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    throw err;
  }
}

// ── upsertStyleCore：仅更新样式字段，不触碰 value 和审计日志 ──
async function upsertStyleCore(sheetId, cells, userId) {
  if (!Array.isArray(cells) || cells.length === 0) return;
  const pool = await getPool();
  const transaction = pool.transaction();
  try {
    await transaction.begin();
    for (const cell of cells) {
      const styleStr = cell.style !== null && cell.style !== undefined
        ? (typeof cell.style === 'string' ? cell.style : JSON.stringify(cell.style))
        : null;
      await transaction.request()
        .input('sheetId_s', sql.Int, sheetId)
        .input('row_s', sql.Int, cell.row)
        .input('col_s', sql.Int, cell.col)
        .input('style_s', sql.NVarChar(sql.MAX), styleStr)
        .input('userId_s', sql.Int, userId)
        .query(`
          MERGE cells AS target
          USING (VALUES (@sheetId_s, @row_s, @col_s, @style_s, @userId_s))
                AS source(sheet_id, row_index, col_index, style, updated_by)
          ON    target.sheet_id  = source.sheet_id
            AND target.row_index = source.row_index
            AND target.col_index = source.col_index
          WHEN MATCHED THEN
            UPDATE SET style = source.style, updated_by = source.updated_by, updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (sheet_id, row_index, col_index, value, style, updated_by)
            VALUES (source.sheet_id, source.row_index, source.col_index, NULL, source.style, source.updated_by);
        `);
    }
    await transaction.commit();
  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    throw err;
  }
}

Object.assign(module.exports, { upsertStyleCore });

// ── 启动时自动迁移：确保 cells 表有 style 列 ──
async function ensureStyleColumn() {
  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('cells') AND name = 'style'
      )
      BEGIN
        ALTER TABLE cells ADD style NVARCHAR(MAX) NULL;
      END
    `);
    console.log('[db] cells.style 列已就绪');
  } catch (err) {
    console.error('[db] 迁移 style 列失败:', err.message);
  }
}
// 模块加载时自动执行
ensureStyleColumn();

// ── HTTP 接口：保存单元格样式（PUT /api/cells/:sheetId/styles）──
async function saveCellStyles(req, res) {
  const sheetId = parseInt(req.params.sheetId, 10);
  const { cells } = req.body;
  if (!sheetId || !Array.isArray(cells) || cells.length === 0) {
    return res.status(400).json({ success: false, error: '参数错误', code: 400 });
  }
  try {
    await upsertStyleCore(sheetId, cells, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[saveCellStyles]', err);
    res.status(500).json({ success: false, error: '样式保存失败', code: 500 });
  }
}

Object.assign(module.exports, { saveCellStyles });
