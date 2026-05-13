# 模块 H — 用户管理模块

## 模块简介
负责系统中用户账号管理，包括增删改查及密码重置。仅管理员账号(admin)可操作。

## 技术栈
- Node.js 18 + Express
- SQL Server
- JSON Web Token (JWT)
- bcryptjs

## 文件列表
- usersRouter.js — 路由定义
- usersController.js — 控制器逻辑
- initAdmin.js — 初始化管理员账号
- README.md — 模块说明

## 测试步骤
1. 安装依赖：npm install mssql bcrypt express
2. 初始化管理员：node initAdmin.js
3. 挂载路由：
```js
const usersRouter = require('./modules/users/usersRouter');
app.use('/api/users', usersRouter);
```
4. 启动服务：node app.js
5. 测试接口（需 JWT Token，admin 登录）：GET/POST/PUT/DELETE /api/users