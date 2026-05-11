# 模块F - 管理后台 UI

## 文件位置
`frontend/src/modules/admin/`

## 功能
- 用户管理页：查看所有用户、新建账号、禁用账号、重置密码
- 权限分配页：选择用户，勾选各目录的读/写权限
- 审计日志页：按文件/用户/时间范围筛选，分页展示修改记录

## 接入方式
1. 在 `App.jsx` 中导入并路由渲染:
```javascript
import AdminPage from './modules/admin/AdminPage';

<Route path="/admin" element={<AdminPage />} />
```

2. 前提条件:
- 当前用户为管理员
- Axios 已配置自动附加 Bearer Token
- 模块A提供 useAuth()

## 测试方法
1. 登录管理员账号
2. 访问 /admin
3. 切换各 Tab 页，检查用户列表、权限分配、审计日志
4. 新建用户、撤销权限、查看日志，确保接口正确返回
