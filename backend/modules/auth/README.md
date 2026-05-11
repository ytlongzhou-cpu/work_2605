# 模块 G — 后端认证模块

## 模块简介
负责用户登录、登出、JWT 验证及管理员权限校验。为系统所有后端模块提供认证支持。

## 技术栈
- Node.js 18 + Express
- SQL Server
- JSON Web Token (JWT)
- bcryptjs

## 文件列表
- authController.js — 登录/登出/获取用户信息
- authRouter.js — 路由定义
- authMiddleware.js — JWT 验证中间件
- jwtHelper.js — JWT 工具函数
- README.md — 模块说明

## 测试步骤
1. 安装依赖：npm install express mssql bcrypt jsonwebtoken
2. 挂载路由：
```js
const authRouter = require('./modules/auth/authRouter');
app.use('/api/auth', authRouter);
```
3. 启动服务：node app.js
4. 测试接口：
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me