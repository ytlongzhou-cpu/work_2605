'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const bcrypt = require('bcrypt');
const { getPool, sql, closePool } = require('../../db');

async function initAdmin() {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query("SELECT COUNT(*) AS cnt FROM users WHERE username = 'admin'");
        if (result.recordset[0].cnt === 0) {
            const hashedPassword = await bcrypt.hash('Admin@123', 10);
            await pool.request()
                .input('username', sql.NVarChar(50), 'admin')
                .input('password', sql.NVarChar(255), hashedPassword)
                .input('display_name', sql.NVarChar(100), '管理员')
                .input('role', sql.NVarChar(20), 'admin')
                .query('INSERT INTO users (username, password, display_name, role) VALUES (@username, @password, @display_name, @role)');
            console.log('✅ 默认管理员创建成功：admin / Admin@123');
        } else {
            console.log('ℹ️  管理员账号已存在，跳过初始化');
        }
        await closePool();
        process.exit(0);
    } catch (err) {
        console.error('❌ 初始化管理员失败', err.message);
        process.exit(1);
    }
}

initAdmin();
