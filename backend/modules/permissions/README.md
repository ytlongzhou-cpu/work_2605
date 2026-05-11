# 模块L - 权限中间件

## 文件位置
`backend/modules/permissions/`

## 功能
- 提供 checkFilePermission(perm) 中间件
- 根据用户角色和 permissions 表判断目录/文件权限
- 管理员角色直接通过
- 支持 read/write 权限检查
- 无权限返回 403 JSON

## 接入方式
1. 在 `backend/app.js` 中挂载路由:
```javascript
const permissionsRouter = require('./modules/permissions/permissionsRouter');
app.use('/api', permissionsRouter);
```

2. 在模块I或模块J接口中使用中间件:
```javascript
const { checkFilePermission } = require('./modules/permissions/permissionMiddleware');
router.get('/files/:fileId', authenticateToken, checkFilePermission('read'), controller.getFile);
```

3. 依赖:
- 模块G 提供 authenticateToken
- 数据库连接池 pool 已配置

## 测试方法
1. 启动后端服务
2. 使用 Postman 或前端调用测试接口
3. 测试:
   - 普通用户访问无权限文件 -> 返回 403
   - 管理员访问所有文件 -> 成功
   - 权限类型 read/write 生效
