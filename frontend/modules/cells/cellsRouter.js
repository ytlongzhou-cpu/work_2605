/**
 * 模块J：单元格读写 - 路由定义
 * 路由前缀挂载在 app.js 中，本文件负责 /api/sheets 和 /api/cells 的路由注册
 *
 * 依赖的外部模块（合并时需确认路径）：
 *   - authenticateToken   来自模块G：backend/modules/auth/authMiddleware.js
 *   - checkFilePermission 来自模块L：backend/modules/permissions/permissionMiddleware.js
 */

'use strict';

const express = require('express');
const router = express.Router();

// 模块G：JWT 认证中间件
const { authenticateToken } = require('../auth/authMiddleware');

// 模块L：目录级权限校验中间件
const { checkFilePermission } = require('../permissions/permissionMiddleware');

const {
  getSheetsByFileId,
  getCellsBySheetId,
  upsertCells,
  saveCellStyles,
} = require('./cellsController');

/**
 * GET /api/sheets/:fileId
 * 获取指定文件的所有 Sheet 列表
 * 权限要求：登录用户 + 文件所属目录 read 权限
 */
router.get(
  '/sheets/:fileId',
  authenticateToken,
  checkFilePermission('read'),
  getSheetsByFileId
);

/**
 * GET /api/cells/:sheetId
 * 获取指定 Sheet 内所有非空单元格数据
 * 权限要求：登录用户 + 文件所属目录 read 权限
 */
router.get(
  '/cells/:sheetId',
  authenticateToken,
  checkFilePermission('read'),
  getCellsBySheetId
);

/**
 * PUT /api/cells/:sheetId
 * 批量 upsert 单元格（SQL Server MERGE 语法），同步写审计日志
 * 权限要求：登录用户 + 文件所属目录 write 权限
 */
router.put(
  '/cells/:sheetId',
  authenticateToken,
  checkFilePermission('write'),
  upsertCells
);

/**
 * PUT /api/cells/:sheetId/styles
 * 批量保存单元格样式（颜色、字体、边框等）
 * 权限要求：登录用户 + 文件所属目录 write 权限
 */
router.put(
  '/cells/:sheetId/styles',
  authenticateToken,
  checkFilePermission('write'),
  saveCellStyles
);

module.exports = router;
