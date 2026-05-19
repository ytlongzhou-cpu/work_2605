const express = require('express');
const router = express.Router();
const { login, logout, getMe } = require('./authController');
const { authenticateToken } = require('./authMiddleware');

router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getMe);

module.exports = router;