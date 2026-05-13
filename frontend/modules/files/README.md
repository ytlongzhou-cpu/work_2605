# 模块I - 文件目录管理 API

## 文件位置
`backend/modules/files/`

## 功能
- GET /api/directories: 获取当前用户可访问目录树
- POST /api/directories: 新建目录（管理员）
- DELETE /api/directories/:id: 删除目录（管理员，目录需为空）
- PUT /api/directories/:id/archive: 归档/取消归档目录
- GET /api/directories/:dirId/files: 获取目录下文件列表
- POST /api/files: 新建文件（管理员，同时创建 Sheet1）
- DELETE /api/files/:id: 删除文件及其 sheets/cells/audit log（管理员）
- PUT /api/files/:id/archive: 归档/取消归档文件

## 接入方式
1. 在 `backend/app.js` 中挂载路由:
```javascript
const filesRouter = require('./modules/files/filesRouter');
app.use('/api', filesRouter);
```

2. 依赖模块:
- 模块G 提供 `authenticateToken` / `requireAdmin`
- 数据库连接池 `db/pool.js` 已配置

## 测试方法
1. 启动后端服务
2. 使用 Postman 或前端调用测试接口
3. 检查以下功能:
   - 目录树返回正确
   - 管理员可创建/删除/归档目录和文件
   - 文件新建自动创建 Sheet1
   - 删除文件级联删除 sheets/cells/audit log
