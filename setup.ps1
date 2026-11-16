# Setup Script for Internship Diary
# Run this AFTER installing Node.js v20 LTS from https://nodejs.org
# Usage: .\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Internship Diary Setup ===" -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Download from https://nodejs.org/en/download" -ForegroundColor Red
    Write-Host "   Install Node.js 20 LTS, then re-run this script." -ForegroundColor Yellow
    exit 1
}

# Check npm
$npmVersion = npm --version
Write-Host "✅ npm $npmVersion found" -ForegroundColor Green

# Install server dependencies
Write-Host "`n📦 Installing server dependencies..." -ForegroundColor Cyan
Set-Location server
npm install
Write-Host "✅ Server dependencies installed" -ForegroundColor Green

# Generate Prisma client
Write-Host "`n🔧 Generating Prisma client..." -ForegroundColor Cyan
npx prisma generate
Write-Host "✅ Prisma client generated" -ForegroundColor Green

# Back to root, install client dependencies
Set-Location ..\client
Write-Host "`n📦 Installing client dependencies..." -ForegroundColor Cyan
npm install
Write-Host "✅ Client dependencies installed" -ForegroundColor Green

Set-Location ..

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Copy and edit server/.env.example -> server/.env with your DB credentials"
Write-Host "  2. Create the PostgreSQL database: CREATE DATABASE internship_diary;"
Write-Host "  3. Run migrations: cd server && npx prisma migrate dev --name init"
Write-Host "  4. Start backend:  cd server && npm run dev"
Write-Host "  5. Start frontend: cd client && npm run dev  (in a new terminal)"
Write-Host ""
Write-Host "  Frontend: http://localhost:5173"
Write-Host "  API:      http://localhost:3001/api/health"
