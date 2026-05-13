'use strict';

const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateUser, deleteUser, resetPassword } = require('./usersController');
const { authenticateToken, requireAdmin } = require('../auth/authMiddleware');

router.use(authenticateToken, requireAdmin);

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/reset-password', resetPassword);

module.exports = router;
