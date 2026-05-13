'use strict';

const { getPool, sql } = require('../../db');

// 获取目录权限列表
exports.getPermissions = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT p.id, p.user_id, p.directory_id, p.perm_type, p.granted_at,
                       u.username, u.display_name, d.name as directory_name
                FROM permissions p
                INNER JOIN users u ON p.user_id = u.id
                INNER JOIN directories d ON p.directory_id = d.id
                ORDER BY p.granted_at DESC
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

// 授予权限
exports.grantPermission = async (req, res) => {
    try {
        const { user_id, directory_id, perm_type } = req.body;
        if (!user_id || !directory_id || !perm_type) {
            return res.status(400).json({ success: false, error: '缺少必要字段', code: 400 });
        }
        if (!['read', 'write'].includes(perm_type)) {
            return res.status(400).json({ success: false, error: 'perm_type 必须为 read 或 write', code: 400 });
        }
        const pool = await getPool();
        // MERGE 实现 upsert
        await pool.request()
            .input('user_id', sql.Int, user_id)
            .input('directory_id', sql.Int, directory_id)
            .input('perm_type', sql.NVarChar(10), perm_type)
            .input('granted_by', sql.Int, req.user.id)
            .query(`
                MERGE permissions AS target
                USING (VALUES (@user_id, @directory_id)) AS source(user_id, directory_id)
                ON target.user_id = source.user_id AND target.directory_id = source.directory_id
                WHEN MATCHED THEN
                    UPDATE SET perm_type = @perm_type, granted_by = @granted_by, granted_at = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (user_id, directory_id, perm_type, granted_by)
                    VALUES (@user_id, @directory_id, @perm_type, @granted_by);
            `);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

// 撤销权限
exports.revokePermission = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM permissions WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};
