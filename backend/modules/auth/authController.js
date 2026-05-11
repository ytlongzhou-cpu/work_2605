'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../../db');

const { JWT_SECRET, JWT_EXPIRES_IN } = process.env;

// 内存黑名单存储已登出 token
const tokenBlacklist = new Set();

async function login(req, res) {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: '缺少用户名或密码', code: 400 });
        }
        const pool = await getPool();
        const result = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .query('SELECT * FROM users WHERE username = @username AND is_active=1');
        const user = result.recordset[0];
        if (!user) return res.status(401).json({ success: false, error: '用户名或密码错误', code: 401 });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ success: false, error: '用户名或密码错误', code: 401 });

        const token = jwt.sign(
            { id: user.id, username: user.username, display_name: user.display_name, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // 更新 last_login
        await pool.request()
            .input('userId', sql.Int, user.id)
            .query('UPDATE users SET last_login = GETDATE() WHERE id = @userId');

        res.json({ success: true, data: { token, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: '登录失败', code: 500 });
    }
}

function logout(req, res) {
    try {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            tokenBlacklist.add(token);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: '登出失败', code: 500 });
    }
}

async function getMe(req, res) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT id, username, display_name, role FROM users WHERE id = @id');
        const user = result.recordset[0];
        if (!user) return res.status(404).json({ success: false, error: '用户不存在', code: 404 });
        res.json({ success: true, data: user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: '获取用户信息失败', code: 500 });
    }
}

module.exports = { login, logout, getMe, tokenBlacklist };
