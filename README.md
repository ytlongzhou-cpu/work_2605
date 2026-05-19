# 协作报表系统 · 安装说明

## 前置要求

| 软件 | 版本要求 | 下载地址 |
|------|----------|----------|
| Node.js | 18 LTS 及以上 | https://nodejs.org |
| SQL Server | 2016 及以上 | 使用现有实例 |

---

## 第一步：初始化数据库

在 SQL Server Management Studio 中：

1. 新建数据库，命名为 `collab_report`
2. 打开 `schema.sql`，选择 `collab_report` 数据库后执行全部脚本

---

## 第二步：配置后端连接

编辑 `backend/.env`，修改以下配置：

```
DB_SERVER=你的SQL Server地址（本机填 localhost）
DB_DATABASE=collab_report
DB_USER=sa
DB_PASSWORD=你的sa密码
JWT_SECRET=随机字符串（可保持默认或自行修改）
```

---

## 第三步：一键安装（推荐）

在 PowerShell 中运行（需要管理员权限）：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

脚本将自动完成：后端依赖安装 → 前端依赖安装 → 前端构建 → 初始化管理员账号 → PM2 启动

---

## 第三步（手动安装）

如不想用脚本，按顺序执行：

```powershell
# 1. 安装后端依赖
cd backend
npm install


# 2. 安装前端依赖并构建
cd ../frontend
npm install
#导出xlsx依赖
npm install xlsx-js-style
#重新构建
npm run build

# 3. 初始化管理员（首次运行时执行一次）
cd ../backend
node modules/users/initAdmin.js

# 4. 启动服务
node app.js
```

---

## 第四步：访问系统

浏览器打开：`http://服务器IP:3000`

默认管理员账号：
- 用户名：`admin`
- 密码：`Admin@123`
- **首次登录后请立即修改密码**

---

## 使用 PM2 守护进程（生产环境推荐）

```powershell
# 安装 PM2
npm install -g pm2

# 启动
pm2 start backend/app.js --name collab-report

# 开机自启（Windows）
pm2 save
pm2 startup

# 查看状态
pm2 status

# 查看日志
pm2 logs collab-report
```

---

## 常见问题

**Q: 提示 "TCP Provider, error: 0 - 连接失败"**
A: 检查 SQL Server 是否允许 TCP 连接，以及防火墙是否放行 1433 端口

**Q: 提示 "Login failed for user 'sa'"**
A: 确认 SQL Server 已启用 SQL Server 身份验证模式，且 sa 密码正确

**Q: 前端页面空白**
A: 确认已执行 `npm run build`，dist 目录已生成

---

## 目录结构

```
collab-report/
├── backend/              后端服务（Node.js + Express）
│   ├── app.js            ← 入口文件
│   ├── .env              ← 数据库 & JWT 配置
│   ├── db.js             ← SQL Server 连接池
│   └── modules/          ← 各功能模块
├── frontend/             前端（React + Handsontable）
│   ├── dist/             ← build 产物（自动生成）
│   ├── src/              ← 源码
│   └── vite.config.js
├── schema.sql            ← 数据库建表脚本
└── install.ps1           ← 一键安装脚本
```
