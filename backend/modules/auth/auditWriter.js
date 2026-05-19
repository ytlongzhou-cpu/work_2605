/**
 * 模块M：审计日志 - 写入工具函数
 *
 * 本文件提供 writeAuditLog() 函数，供模块J（单元格写入）内部调用。
 * 调用者负责传入数据库连接（事务或连接池），以支持原子性写入。
 *
 * 写入目标表：cell_audit_log
 */

'use strict';

const { getPool, sql } = require('../../db');

/**
 * 写入一条审计日志记录
 *
 * @param {object}  ctx        - 数据库上下文，{ transaction } 或 {} (使用连接池)
 *                               传入 transaction 时，在同一事务内写入，保证原子性
 * @param {number}  sheetId    - Sheet ID（对应 sheets.id）
 * @param {number}  row        - 行索引（0-based）
 * @param {number}  col        - 列索引（0-based）
 * @param {string|null} oldVal - 修改前的值（null 表示该单元格之前不存在）
 * @param {string|null} newVal - 修改后的值（null 表示清空单元格）
 * @param {number}  userId     - 操作人 ID（对应 users.id）
 * @returns {Promise<void>}
 */
async function writeAuditLog(ctx, sheetId, row, col, oldVal, newVal, userId) {
  try {
    // 优先使用调用方传入的事务，否则从连接池获取新连接
    const requester = ctx && ctx.transaction
      ? ctx.transaction.request()
      : (await getPool()).request();

    await requester
      .input('sheetId_al', sql.Int,          sheetId)
      .input('row_al',     sql.Int,          row)
      .input('col_al',     sql.Int,          col)
      .input('oldVal_al',  sql.NVarChar(sql.MAX), oldVal  ?? null)
      .input('newVal_al',  sql.NVarChar(sql.MAX), newVal  ?? null)
      .input('userId_al',  sql.Int,          userId)
      .query(`
        INSERT INTO cell_audit_log
          (sheet_id, row_index, col_index, old_value, new_value, changed_by, changed_at)
        VALUES
          (@sheetId_al, @row_al, @col_al, @oldVal_al, @newVal_al, @userId_al, GETDATE())
      `);
  } catch (err) {
    // 审计日志写入失败不应阻断主业务，但需记录错误
    // 若在事务中调用，错误会向上抛出由调用方统一回滚
    console.error('[auditWriter] writeAuditLog error:', err);
    throw err; // 重新抛出，让事务回滚生效
  }
}

module.exports = { writeAuditLog };
