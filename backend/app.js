'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const path       = require('path');  // BUG FIX：path 应在顶部引入
const { Server } = require('socket.io');

const authRouter        = require('./modules/auth/authRouter');
const usersRouter       = require('./modules/users/usersRouter');
const filesRouter       = require('./modules/files/filesRouter');
const cellsRouter       = require('./modules/cells/cellsRouter');
const permissionsRouter = require('./modules/permissions/permissionsRouter');
const auditRouter       = require('./modules/auth/auditRouter');
const { initSocketHandler } = require('./modules/collaboration/socketHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── 中间件 ──
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

// ── API 路由（必须在静态文件之前注册）──
app.use('/api/auth',        authRouter);
app.use('/api/users',       usersRouter);
app.use('/api',             filesRouter);   // /api/directories, /api/files
app.use('/api',             cellsRouter);   // /api/sheets/:fileId, /api/cells/:sheetId
app.use('/api/permissions', permissionsRouter);
app.use('/api/audit',       auditRouter);

// ── 静态文件（前端 build 产物）──
// BUG FIX：app.js 在 frontend/ 目录下，build 产物在 backend/dist/
// __dirname = .../collab-report/frontend，所以正确路径是 ../backend/dist
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// BUG FIX：catch-all 只处理非 /api 路径，避免拦截 API 404 错误
// 所有 /api/* 未匹配的路由返回 404 JSON，而不是 index.html
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在', code: 404 });
});

// 前端 SPA 路由：其他所有路径返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── HTTP Server + Socket.io ──
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
initSocketHandler(io);

httpServer.listen(PORT, () => {
  console.log(`✅ 协作报表系统已启动：http://localhost:${PORT}`);
});

const { closePool } = require('./db');

// 优雅关闭：先关 HTTP server，再关数据库连接池
function gracefulShutdown() {
  httpServer.close(async () => {
    await closePool();
    process.exit(0);
  });
}
process.on('SIGINT',  gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
