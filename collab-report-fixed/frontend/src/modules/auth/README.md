# 模块 A（登录/认证）+ 模块 B（主框架/导航）

协作报表系统前端 — 模块 A & B 交付说明

---

## 文件清单

```
src/
├── App.jsx                            # 根路由配置（整合 A + B）
├── modules/
│   ├── auth/                          # 模块 A：登录 / 认证
│   │   ├── authApi.js                 # Axios 实例 + /api/auth/* 请求函数
│   │   ├── AuthContext.jsx            # 全局认证状态（React Context）
│   │   ├── PrivateRoute.jsx           # 路由守卫
│   │   └── LoginPage.jsx             # 登录页面组件
│   └── layout/                        # 模块 B：主框架 / 导航
│       ├── AppLayout.jsx              # 主框架容器（含 LayoutContext）
│       ├── TopBar.jsx                 # 顶部栏
│       ├── Sidebar.jsx                # 左侧边栏
│       └── OnlineUsers.jsx            # 在线用户头像列表
```

---

## 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | 18 LTS + |
| npm | 9+ |

---

## 安装 & 启动

```bash
# 1. 复制环境变量配置
cp .env.example .env
# 若后端不在 localhost:3000，修改 VITE_API_BASE_URL

# 2. 安装依赖
npm install

# 3. 启动开发服务器（热更新）
npm run dev
# 访问 http://localhost:5173

# 4. 构建生产包（输出至 ../backend/public）
npm run build
```

---

## 测试模块 A — 登录 / 认证

### 前置条件
后端模块 G（认证）已启动，`POST /api/auth/login` 可正常响应。

### 测试步骤

#### 1. 正常登录流程
1. 访问 `http://localhost:5173`，自动跳转到 `/login`
2. 输入管理员账号 `admin / Admin@123`，点击登录
3. ✅ 预期：跳转到 `/app`，TopBar 右上角显示当前用户名

#### 2. 错误密码
1. 输入错误密码提交
2. ✅ 预期：表单下方显示红色错误横幅，字段边框变红

#### 3. 空字段校验
1. 不填写任何内容直接点击登录
2. ✅ 预期：显示"请输入用户名和密码"提示，不发起请求

#### 4. Token 自动注入（Axios 拦截器）
1. 登录成功后，打开浏览器 DevTools → Network
2. 访问任意 `/api/*` 接口
3. ✅ 预期：请求 Header 中包含 `Authorization: Bearer eyJ...`

#### 5. 路由守卫
1. 登出后在地址栏直接输入 `/app`
2. ✅ 预期：自动跳转回 `/login`

#### 6. 401 自动跳回登录页
可在 DevTools 中拦截响应并修改状态码为 401，或等待 Token 过期：
- ✅ 预期：自动清除状态并跳转 `/login`

#### 7. 登出
1. 点击 TopBar 右上角"退出"按钮
2. ✅ 预期：跳转到 `/login`，再访问 `/app` 被拦截

---

## 测试模块 B — 主框架 / 导航

### 测试步骤

#### 1. 整体布局
1. 登录后查看 `/app`
2. ✅ 预期：页面分为顶部栏（蓝色 52px）+ 左侧边栏（200px）+ 右侧内容区（自适应）

#### 2. TopBar 内容
- ✅ 左上角显示 Logo 图标 + "协作报表" 文字
- ✅ 右侧显示当前用户名 + "退出" 按钮
- ✅ 面包屑区域（等待模块 C/D 写入时为空）

#### 3. 保存状态指示
通过 `useLayout().setSaveStatus()` 写入状态（可在 DevTools Console 调试）：

```js
// 在集成模块 D 后，模块 D 会自动调用此方法
// 手动测试：在支持 HMR 的组件中临时调用
```

状态值对应文案：
- `'saving'`  → 橙色 "保存中..."
- `'saved'`   → 绿色 "已保存"
- `'unsaved'` → 红色 "未保存"

#### 4. Sidebar 操作按钮
- 管理员账号登录 → ✅ 显示"新建目录"和"删除"按钮
- 普通用户账号登录 → ✅ 不显示上述按钮
- 未选中文件时 → ✅ "归档"和"删除"按钮显示为灰色禁用状态

#### 5. 在线用户头像
通过 `useLayout().setOnlineUsers()` 注入测试数据（模块 E 集成后自动填充）：

```js
// 在任意消费了 LayoutContext 的组件中测试
import { useLayout } from './modules/layout/AppLayout';
const { setOnlineUsers } = useLayout();
setOnlineUsers([
  { userId: 1, displayName: '张三', color: '#1D9E75' },
  { userId: 2, displayName: '李四', color: '#378ADD' },
]);
```

✅ 预期：TopBar 右侧出现彩色头像气泡，Hover 显示姓名 Tooltip

---

## 对外暴露接口（供其他模块调用）

### 模块 A — AuthContext

```js
import { useAuth } from './modules/auth/AuthContext';

const { user, token, login, logout, loading } = useAuth();
// user:    { id, username, display_name, role } | null
// token:   string | null（内存中的 JWT）
// login:   async (username, password) => void
// logout:  async () => void
// loading: boolean（初始化检测中）
```

### 模块 A — apiClient（Axios 实例）

```js
import { apiClient } from './modules/auth/authApi';
// 其他模块的所有 HTTP 请求统一使用此实例
// 登录后拦截器自动注入 Authorization Header
```

### 模块 B — useLayout（布局数据总线）

```js
import { useLayout } from './modules/layout/AppLayout';

const {
  setBreadcrumbs,   // (crumbs: [{label, id?}][]) => void  — 模块 C/D 调用
  setSaveStatus,    // ('saved'|'saving'|'unsaved'|null) => void  — 模块 D 调用
  setOnlineUsers,   // (users: [{userId, displayName, color}][]) => void  — 模块 E 调用
  setSidebarProps,  // (partialProps: object) => void  — 模块 C 调用
} = useLayout();
```

### 模块 B — Sidebar Props 接口

```js
// 模块 C 通过 setSidebarProps() 写入以下字段：
{
  treeData: [],           // 目录树数组
  selectedFileId: null,   // 当前选中文件 ID
  onFileSelect: (id) => {},
  onNewDir:  () => {},
  onNewFile: () => {},
  onArchive: () => {},
  onDelete:  () => {},
}
```

---

## 注意事项

1. **Token 不写 localStorage**：刷新页面需重新登录，符合安全要求。
2. **axios 实例共享**：所有模块通过 `apiClient` 发请求，不要自行创建新实例。
3. **LayoutContext 边界**：`useLayout()` 必须在 `<AppLayout>` 渲染树内使用；
   登录页在此范围之外，不可调用。
4. **管理员判断**：`user.role === 'admin'` 由 JWT 中携带，前端判断仅用于 UI 显示，
   实际权限校验由后端模块 G/L 负责。
