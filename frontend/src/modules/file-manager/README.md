# 模块C - 文件目录管理

## 文件位置
src/modules/file-manager/

## 功能
- 渲染用户可访问的目录树
- 支持目录/文件新建、删除、归档
- 管理员可见删除按钮
- 弹窗输入名称创建目录或文件

## 接入方式
1. 在 App.jsx 或 Sidebar.jsx 中导入：
```javascript
import FileTree from './modules/file-manager/FileTree';
```

2. 在 Sidebar 中使用：
```javascript
<FileTree onFileSelect={(fileId) => { console.log('选择文件', fileId); }} />
```

3. 依赖模块：
- useAuth() 提供当前用户信息和 token
- Axios 已配置自动附加 Bearer Token

## 测试方法
1. 启动后端 npm run dev 并确保数据库已建表
2. 登录系统
3. 在 Sidebar 渲染 <FileTree />
4. 测试：
   - 点击展开/折叠目录
   - 新建目录/文件弹窗
   - 管理员删除按钮可见并生效
   - 点击文件触发 onFileSelect
