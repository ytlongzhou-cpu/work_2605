/**
 * 数据库连接池模块（公共依赖）
 * 路径：backend/db.js
 *
 * 基于 mssql 库封装单例连接池，供所有后端模块共享使用。
 * 连接配置从环境变量读取（见 .env 文件）。
 *
 * 使用示例：
 *   const { getPool, sql } = require('../../db');
 *   const pool = await getPool();
 *   const result = await pool.request()
 *     .input('id', sql.Int, 1)
 *     .query('SELECT * FROM users WHERE id = @id');
 */

'use strict';

const mssql = require('mssql');

// SQL Server 连接配置（读取环境变量，需配置 backend/.env）
const dbConfig = {
  server:   process.env.DB_SERVER   || 'localhost',
  database: process.env.DB_DATABASE || 'collab_report',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt:                false, // 局域网内部署，关闭加密
    trustServerCertificate: true,  // 兼容自签证书
    enableArithAbort:       true,  // SQL Server 2016 要求
  },
  pool: {
    max:              10,  // 最大连接数
    min:              2,   // 最小保持连接数
    idleTimeoutMillis: 30000,
  },
};

/** 单例连接池 */
let _pool = null;

/**
 * 获取数据库连接池（懒初始化，首次调用时建立连接）
 * @returns {Promise<mssql.ConnectionPool>}
 */
async function getPool() {
  if (_pool && _pool.connected) {
    return _pool;
  }
  _pool = await mssql.connect(dbConfig);
  console.log('[db] SQL Server 连接池已建立');
  return _pool;
}

/**
 * 关闭连接池（用于进程退出时优雅关闭）
 */
async function closePool() {
  if (_pool) {
    await _pool.close();
    _pool = null;
    console.log('[db] SQL Server 连接池已关闭');
  }
}

// BUG FIX：移除此处的进程退出事件监听，避免与 app.js 重复注册产生竞争条件。
// 优雅关闭由 app.js 统一在 httpServer.close() 回调中调用 closePool()。

module.exports = { getPool, closePool, sql: mssql };
