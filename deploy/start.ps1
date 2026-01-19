$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "Starting OurBlock..." -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "WARNING: No .env file found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env file" -ForegroundColor Green
    Write-Host "WARNING: Update ADMIN_API_KEY in .env before production use!" -ForegroundColor Yellow
    Write-Host ""
}

# Build images if needed
Write-Host "Building Docker images..." -ForegroundColor Cyan
docker compose build

Write-Host ""
Write-Host "Starting infrastructure services..." -ForegroundColor Cyan
docker compose up -d socket-proxy

Write-Host "Waiting for socket-proxy to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Starting sidecar service..." -ForegroundColor Cyan
docker compose up -d sidecar

Write-Host "Waiting for sidecar to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Starting HTTPS proxy..." -ForegroundColor Cyan
docker compose up -d nginx

Write-Host "Waiting for nginx to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Starting Holochain services..." -ForegroundColor Cyan
docker compose up -d lair-keystore ourblock

Write-Host "Waiting for conductor to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Starting UI..." -ForegroundColor Cyan
docker compose up -d ui

Write-Host ""
Write-Host "OurBlock is starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "Service Status:" -ForegroundColor Cyan
docker compose ps

Write-Host ""
Write-Host "Access Points:" -ForegroundColor Cyan
Write-Host "  - Main App:    http://localhost:5173"
Write-Host "  - Admin API:   https://localhost:4443 (localhost only)"
Write-Host "  - Conductor:   ws://localhost:8888"
Write-Host ""
Write-Host "Logs:" -ForegroundColor Cyan
Write-Host "  - View all:     docker compose logs -f"
Write-Host "  - View UI:      docker compose logs -f ui"
Write-Host "  - View sidecar: docker compose logs -f sidecar"
Write-Host ""
Write-Host "To stop:         .\stop.ps1" -ForegroundColor Yellow
Write-Host ""
