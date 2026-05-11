'use strict';

const bcrypt = require('bcrypt');
const { getPool, sql } = require('../../db');

async function getAllUsers(req, res) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query('SELECT id, username, display_name, role, is_active, created_at, last_login FROM users ORDER BY id');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: '获取用户列表失败', code: 500 });
    }
}

async function createUser(req, res) {
    try {
        const { username, password, display_name, role } = req.body;
        if (!username || !password || !display_name) {
            return res.status(400).json({ success: false, error: '缺少必要字段', code: 400 });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const pool = await getPool();
        const result = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .input('password', sql.NVarChar(255), hashedPassword)
            .input('display_name', sql.NVarChar(100), display_name)
            .input('role', sql.NVarChar(20), role || 'user')
            .query('INSERT INTO users (username, password, display_name, role) OUTPUT INSERTED.id, INSERTED.username, INSERTED.display_name, INSERTED.role, INSERTED.is_active, INSERTED.created_at VALUES (@username, @password, @display_name, @role)');
        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (err) {
        console.error(err);
        if (err.message && err.message.includes('UNIQUE')) {
            res.status(400).json({ success: false, error: '用户名已存在', code: 400 });
        } else {
            res.status(500).json({ success: false, error: '创建用户失败', code: 500 });
        }
    }
}

// 修复：使用参数化查询，消除 SQL 注入漏洞
async function updateUser(req, res) {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ success: false, error: '无效的用户ID', code: 400 });

        const { display_name, password, is_active } = req.body;
        if (!display_name && password === undefined && is_active === undefined) {
            return res.status(400).json({ success: false, error: '没有更新字段', code: 400 });
        }

        const pool = await getPool();
        const request = pool.request().input('id', sql.Int, userId);
        const setParts = [];

        if (display_name) {
            request.input('display_name', sql.NVarChar(100), display_name);
            setParts.push('display_name = @display_name');
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            request.input('password', sql.NVarChar(255), hashedPassword);
            setParts.push('password = @password');
        }
        if (is_active !== undefined) {
            request.input('is_active', sql.Bit, is_active ? 1 : 0);
            setParts.push('is_active = @is_active');
        }

        const result = await request.query(
            `UPDATE users SET ${setParts.join(', ')} WHERE id = @id;
             SELECT id, username, display_name, role, is_active FROM users WHERE id = @id`
        );
        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: '更新用户失败', code: 500 });
    }
}

async function deleteUser(req, res) {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ success: false, error: '无效的用户ID', code: 400 });
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, userId)
            .query('UPDATE users SET is_active = 0 WHERE id = @id; SELECT id, username, display_name, role, is_active FROM users WHERE id = @id');
        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: '禁用用户失败', code: 500 });
    }
}

async function resetPassword(req, res) {
    try {
        const userId = parseInt(req.params.id);
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, error: '密码不能少于6位', code: 400 });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, userId)
            .input('password', sql.NVarChar(255), hashedPassword)
            .query('UPDATE users SET password = @password WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: '重置密码失败', code: 500 });
    }
}

module.exports = { getAllUsers, createUser, updateUser, deleteUser, resetPassword };
