'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../auth/authMiddleware');
const permissionsController = require('./permissionsController');

router.get('/', authenticateToken, requireAdmin, permissionsController.getPermissions);
router.post('/', authenticateToken, requireAdmin, permissionsController.grantPermission);
router.delete('/:id', authenticateToken, requireAdmin, permissionsController.revokePermission);

module.exports = router;
