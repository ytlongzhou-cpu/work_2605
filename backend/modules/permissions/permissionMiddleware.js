'use strict';

const { getPool, sql } = require('../../db');

function checkFilePermission(perm) {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) return res.status(401).json({ success: false, error: '未认证', code: 401 });

            // 管理员直接通过
            if (user.role === 'admin') return next();

            const fileId = req.params.fileId || req.body.fileId;
            const sheetId = req.params.sheetId || req.body.sheetId;
            let directoryId = null;

            const pool = await getPool();

            if (fileId) {
                const fileRes = await pool.request()
                    .input('fileId', sql.Int, parseInt(fileId))
                    .query('SELECT directory_id FROM files WHERE id=@fileId AND is_archived=0');
                if (!fileRes.recordset[0]) return res.status(404).json({ success: false, error: '文件不存在', code: 404 });
                directoryId = fileRes.recordset[0].directory_id;
            } else if (sheetId) {
                const sheetRes = await pool.request()
                    .input('sheetId', sql.Int, parseInt(sheetId))
                    .query('SELECT f.directory_id FROM sheets s INNER JOIN files f ON s.file_id=f.id WHERE s.id=@sheetId');
                if (!sheetRes.recordset[0]) return res.status(404).json({ success: false, error: 'Sheet不存在', code: 404 });
                directoryId = sheetRes.recordset[0].directory_id;
            } else {
                return res.status(400).json({ success: false, error: '缺少 fileId 或 sheetId', code: 400 });
            }

            const permRes = await pool.request()
                .input('userId', sql.Int, user.id)
                .input('directoryId', sql.Int, directoryId)
                .query('SELECT perm_type FROM permissions WHERE user_id=@userId AND directory_id=@directoryId');

            if (!permRes.recordset[0]) return res.status(403).json({ success: false, error: '无权限', code: 403 });

            const userPerm = permRes.recordset[0].perm_type;
            if (perm === 'read' && (userPerm === 'read' || userPerm === 'write')) return next();
            if (perm === 'write' && userPerm === 'write') return next();

            return res.status(403).json({ success: false, error: '权限不足', code: 403 });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message, code: 500 });
        }
    };
}

module.exports = { checkFilePermission };
