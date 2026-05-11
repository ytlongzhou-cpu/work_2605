'use strict';

const { getPool, sql } = require('../../db');

exports.getDirectories = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        const pool = await getPool();

        let result;
        if (isAdmin) {
            result = await pool.request()
                .query('SELECT * FROM directories WHERE is_archived = 0 ORDER BY parent_id, name');
        } else {
            // BUG FIX：非管理员需要包含有权限目录的所有祖先目录，否则前端无法构建树结构
            // 用 CTE 递归向上查找所有祖先目录（WITH NOLOCK 不需要，直接查）
            result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    WITH authorized AS (
                        -- 用户直接有权限的目录
                        SELECT DISTINCT d.id
                        FROM directories d
                        INNER JOIN permissions p ON d.id = p.directory_id
                        WHERE p.user_id = @userId AND d.is_archived = 0
                    ),
                    ancestors AS (
                        -- 递归找所有祖先
                        SELECT d.id, d.parent_id FROM directories d
                        INNER JOIN authorized a ON d.id = a.id
                        UNION ALL
                        SELECT d.id, d.parent_id FROM directories d
                        INNER JOIN ancestors anc ON d.id = anc.parent_id
                        WHERE d.is_archived = 0
                    )
                    SELECT DISTINCT d.*
                    FROM directories d
                    INNER JOIN ancestors anc ON d.id = anc.id
                    WHERE d.is_archived = 0
                    ORDER BY d.parent_id, d.name
                `);
        }
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

exports.createDirectory = async (req, res) => {
    try {
        const { name, parent_id } = req.body;
        if (!name) return res.status(400).json({ success: false, error: '目录名不能为空', code: 400 });
        const created_by = req.user.id;
        const pool = await getPool();
        const result = await pool.request()
            .input('name', sql.NVarChar(100), name)
            .input('parent_id', sql.Int, parent_id || null)
            .input('created_by', sql.Int, created_by)
            .query('INSERT INTO directories (name, parent_id, created_by) OUTPUT INSERTED.id VALUES (@name, @parent_id, @created_by)');
        res.status(201).json({ success: true, data: { id: result.recordset[0].id, name, parent_id } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

exports.deleteDirectory = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const pool = await getPool();
        const fileCheck = await pool.request()
            .input('dirId', sql.Int, id)
            .query('SELECT COUNT(*) as cnt FROM files WHERE directory_id=@dirId AND is_archived=0');
        if (fileCheck.recordset[0].cnt > 0)
            return res.status(400).json({ success: false, error: '目录不为空，请先删除或归档所有文件', code: 400 });
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM directories WHERE id=@id');
        res.json({ success: true, data: { id } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

exports.toggleDirectoryArchive = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const pool = await getPool();
        const current = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT is_archived FROM directories WHERE id=@id');
        if (!current.recordset[0]) return res.status(404).json({ success: false, error: '目录不存在', code: 404 });
        const newStatus = current.recordset[0].is_archived ? 0 : 1;
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.Bit, newStatus)
            .query('UPDATE directories SET is_archived=@status WHERE id=@id');
        res.json({ success: true, data: { id, is_archived: !!newStatus } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

exports.getFiles = async (req, res) => {
    try {
        const dirId = parseInt(req.params.dirId);
        const pool = await getPool();
        const result = await pool.request()
            .input('dirId', sql.Int, dirId)
            .query('SELECT * FROM files WHERE directory_id=@dirId AND is_archived=0 ORDER BY name');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

exports.createFile = async (req, res) => {
    const pool = await getPool();
    const transaction = pool.transaction();
    try {
        const { name, directory_id } = req.body;
        if (!name || !directory_id) return res.status(400).json({ success: false, error: '缺少文件名或目录', code: 400 });
        const created_by = req.user.id;
        await transaction.begin();

        const fileInsert = await transaction.request()
            .input('name', sql.NVarChar(200), name)
            .input('directory_id', sql.Int, directory_id)
            .input('created_by', sql.Int, created_by)
            .query('INSERT INTO files (name, directory_id, created_by) OUTPUT INSERTED.id VALUES (@name, @directory_id, @created_by)');
        const fileId = fileInsert.recordset[0].id;

        await transaction.request()
            .input('file_id', sql.Int, fileId)
            .input('sheet_name', sql.NVarChar(100), 'Sheet1')
            .query('INSERT INTO sheets (file_id, name, sort_order) VALUES (@file_id, @sheet_name, 0)');

        await transaction.commit();
        res.status(201).json({ success: true, data: { id: fileId, name, directory_id } });
    } catch (err) {
        try { await transaction.rollback(); } catch (_) {}
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

exports.deleteFile = async (req, res) => {
    const pool = await getPool();
    const transaction = pool.transaction();
    try {
        const id = parseInt(req.params.id);
        await transaction.begin();
        await transaction.request().input('fileId', sql.Int, id)
            .query('DELETE l FROM cell_audit_log l INNER JOIN sheets s ON l.sheet_id=s.id WHERE s.file_id=@fileId');
        await transaction.request().input('fileId', sql.Int, id)
            .query('DELETE c FROM cells c INNER JOIN sheets s ON c.sheet_id=s.id WHERE s.file_id=@fileId');
        await transaction.request().input('fileId', sql.Int, id)
            .query('DELETE FROM edit_sessions WHERE sheet_id IN (SELECT id FROM sheets WHERE file_id=@fileId)');
        await transaction.request().input('fileId', sql.Int, id)
            .query('DELETE FROM sheets WHERE file_id=@fileId');
        await transaction.request().input('id', sql.Int, id)
            .query('DELETE FROM files WHERE id=@id');
        await transaction.commit();
        res.json({ success: true, data: { id } });
    } catch (err) {
        try { await transaction.rollback(); } catch (_) {}
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};

exports.toggleFileArchive = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const pool = await getPool();
        const current = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT is_archived FROM files WHERE id=@id');
        if (!current.recordset[0]) return res.status(404).json({ success: false, error: '文件不存在', code: 404 });
        const newStatus = current.recordset[0].is_archived ? 0 : 1;
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.Bit, newStatus)
            .query('UPDATE files SET is_archived=@status, updated_at=GETDATE() WHERE id=@id');
        res.json({ success: true, data: { id, is_archived: !!newStatus } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 500 });
    }
};
