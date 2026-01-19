$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "Stopping OurBlock..." -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping services..." -ForegroundColor Cyan
docker compose down

Write-Host ""
Write-Host "OurBlock stopped successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To view stopped containers: docker compose ps -a" -ForegroundColor Cyan
Write-Host "To remove volumes:         docker compose down -v" -ForegroundColor Yellow
Write-Host "To start again:             .\start.ps1" -ForegroundColor Cyan
Write-Host ""
