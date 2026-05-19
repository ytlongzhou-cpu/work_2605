'use strict';
require('dotenv').config();
const bcrypt = require('bcrypt');
const { getPool, sql, closePool } = require('./db');

const NEW_PASSWORD = 'Admin@123';

(async () => {
  try {
    const hash = await bcrypt.hash(NEW_PASSWORD, 10);
    console.log('Generated hash:', hash);
    
    const pool = await getPool();
    
    // 验证用户存在
    const check = await pool.request()
      .input('u', sql.NVarChar(50), 'admin')
      .query('SELECT id, username, password FROM users WHERE username = @u');
    
    if (check.recordset.length === 0) {
      console.log('ERROR: admin user not found!');
      process.exit(1);
    }
    
    console.log('Found user id:', check.recordset[0].id);
    console.log('Old hash:', check.recordset[0].password);
    
    // 重置密码
    await pool.request()
      .input('hash', sql.NVarChar(255), hash)
      .input('u', sql.NVarChar(50), 'admin')
      .query('UPDATE users SET password = @hash WHERE username = @u');
    
    // 验证新hash可以工作
    const verify = await bcrypt.compare(NEW_PASSWORD, hash);
    console.log('New hash verify test:', verify ? 'PASS' : 'FAIL');
    console.log('Password reset to: Admin@123');
    
    await closePool();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
