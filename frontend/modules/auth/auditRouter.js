/**
 * 模块M：审计日志 - 路由定义
 * 路由前缀：/api/audit（在 app.js 中挂载）
 *
 * 依赖：
 *   - authenticateToken  来自模块G：backend/modules/auth/authMiddleware.js
 *   - requireAdmin       来自模块G：backend/modules/auth/authMiddleware.js
 */

'use strict';

const express = require('express');
const router = express.Router();

// 模块G：认证中间件 + 管理员校验中间件
const { authenticateToken, requireAdmin } = require('../auth/authMiddleware');

const { queryAuditLog } = require('./auditController');

/**
 * GET /api/audit
 * 查询审计日志，仅管理员可访问
 *
 * 查询参数（均可选）：
 *   sheet_id {number}  - 按 Sheet 筛选
 *   user_id  {number}  - 按操作人筛选
 *   from     {string}  - 起始时间 ISO 8601（如 2024-01-01）
 *   to       {string}  - 截止时间 ISO 8601（如 2024-12-31）
 *   page     {number}  - 页码，默认 1
 *   limit    {number}  - 每页条数，默认 50，最大 200
 */
router.get('/', authenticateToken, requireAdmin, queryAuditLog);

module.exports = router;
