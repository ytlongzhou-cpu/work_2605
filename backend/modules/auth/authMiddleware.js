const jwt = require('jsonwebtoken');
const { tokenBlacklist } = require('./authController');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * JWT 验证中间件
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: '未提供 token', code: 401 });
    if (tokenBlacklist.has(token)) return res.status(401).json({ success: false, error: 'Token 已登出', code: 401 });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Token 无效', code: 403 });
        req.user = user;
        next();
    });
}

/**
 * 管理员权限校验
 */
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: '管理员权限不足', code: 403 });
    next();
}

module.exports = { authenticateToken, requireAdmin };