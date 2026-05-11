'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
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

// ── API 路由 ──
app.use('/api/auth',        authRouter);
app.use('/api/users',       usersRouter);
app.use('/api',             filesRouter);   // /api/directories, /api/files
app.use('/api',             cellsRouter);   // /api/sheets/:fileId, /api/cells/:sheetId
app.use('/api/permissions', permissionsRouter);
app.use('/api/audit',       auditRouter);

// ── 静态文件（前端 build 产物） ──
const path = require('path');
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
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

// 优雅关闭
process.on('SIGINT',  () => { httpServer.close(() => process.exit(0)); });
process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)); });
