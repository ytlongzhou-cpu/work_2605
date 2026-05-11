'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../auth/authMiddleware');
const filesController = require('./filesController');

router.get('/directories', authenticateToken, filesController.getDirectories);
router.post('/directories', authenticateToken, requireAdmin, filesController.createDirectory);
router.delete('/directories/:id', authenticateToken, requireAdmin, filesController.deleteDirectory);
router.put('/directories/:id/archive', authenticateToken, requireAdmin, filesController.toggleDirectoryArchive);
router.get('/directories/:dirId/files', authenticateToken, filesController.getFiles);
router.post('/files', authenticateToken, requireAdmin, filesController.createFile);
router.delete('/files/:id', authenticateToken, requireAdmin, filesController.deleteFile);
router.put('/files/:id/archive', authenticateToken, requireAdmin, filesController.toggleFileArchive);

module.exports = router;
