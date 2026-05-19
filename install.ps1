# ============================================================
# 协作报表系统 一键安装脚本 (PowerShell)
# 使用方法: Set-ExecutionPolicy -Scope Process Bypass; .\install.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================"
Write-Host "  Collab Report System - Installer"
Write-Host "========================================"

# 1. 检查 Node.js
Write-Host ""
Write-Host "[1/6] Checking Node.js..."
try {
    $nodeVersion = (node --version 2>&1)
    Write-Host "  OK: Node.js $nodeVersion"
} catch {
    Write-Host "  ERROR: Node.js not found. Please install Node.js 18 LTS from https://nodejs.org"
    exit 1
}

# 2. 安装后端依赖
Write-Host ""
Write-Host "[2/6] Installing backend dependencies..."
Set-Location "$root\backend"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Backend npm install failed"; exit 1 }
Write-Host "  OK: Backend dependencies installed"

# 3. 安装前端依赖
Write-Host ""
Write-Host "[3/6] Installing frontend dependencies..."
Set-Location "$root\frontend"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Frontend npm install failed"; exit 1 }
Write-Host "  OK: Frontend dependencies installed"

# 4. 构建前端
Write-Host ""
Write-Host "[4/6] Building frontend..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Frontend build failed"; exit 1 }
Write-Host "  OK: Frontend built"

# 5. 配置确认
Write-Host ""
Write-Host "[5/6] Database config (backend\.env):"
Get-Content "$root\backend\.env" | ForEach-Object { Write-Host "    $_" }
Write-Host ""
$confirm = Read-Host "Config looks correct? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Please edit backend\.env then re-run this script."
    Set-Location $root
    exit 0
}

# 6. 初始化管理员
Write-Host ""
Write-Host "[6/6] Initializing admin account..."
Set-Location "$root\backend"
node modules/users/initAdmin.js
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Admin init failed - check DB config"; exit 1 }

# 完成
Write-Host ""
Write-Host "========================================"
Write-Host "  Installation complete!"
Write-Host "========================================"
Write-Host ""
Write-Host "To start the server:"
Write-Host "  cd backend"
Write-Host "  node app.js"
Write-Host ""
Write-Host "Or use PM2 (recommended for production):"
Write-Host "  npm install -g pm2"
Write-Host "  pm2 start backend/app.js --name collab-report"
Write-Host "  pm2 save"
Write-Host ""
Write-Host "Access: http://localhost:3000"
Write-Host "Login:  admin / Admin@123"
Write-Host ""

$startNow = Read-Host "Start server now with node? (y/n)"
if ($startNow -eq 'y') {
    Set-Location "$root\backend"
    node app.js
}

Set-Location $root
