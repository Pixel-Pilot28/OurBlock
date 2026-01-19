# PowerShell script to generate self-signed SSL certificates for localhost
# Requires OpenSSL (available in Git Bash or WSL)

$ErrorActionPreference = "Stop"

$CERT_DIR = "certs"
$CERT_FILE = "$CERT_DIR/localhost.crt"
$KEY_FILE = "$CERT_DIR/localhost.key"

# Create certs directory if it doesn't exist
if (-not (Test-Path $CERT_DIR)) {
    New-Item -ItemType Directory -Path $CERT_DIR | Out-Null
}

# Check if certificates already exist
if ((Test-Path $CERT_FILE) -and (Test-Path $KEY_FILE)) {
    Write-Host "✓ Certificates already exist in $CERT_DIR/" -ForegroundColor Green
    Write-Host "  - Certificate: $CERT_FILE"
    Write-Host "  - Private Key: $KEY_FILE"
    exit 0
}

Write-Host "Generating self-signed SSL certificate for localhost..." -ForegroundColor Cyan

# Check if OpenSSL is available
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Host "❌ OpenSSL not found!" -ForegroundColor Red
    Write-Host "   Please install OpenSSL via:" -ForegroundColor Yellow
    Write-Host "   - Git for Windows (includes OpenSSL)" -ForegroundColor Yellow
    Write-Host "   - WSL (Windows Subsystem for Linux)" -ForegroundColor Yellow
    Write-Host "   - Or download from https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    exit 1
}

# Generate private key and certificate
& openssl req -x509 `
    -nodes `
    -days 365 `
    -newkey rsa:2048 `
    -keyout $KEY_FILE `
    -out $CERT_FILE `
    -subj "/C=US/ST=State/L=City/O=OurBlock/OU=Development/CN=localhost" `
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate certificates" -ForegroundColor Red
    exit 1
}

Write-Host "✓ SSL certificates generated successfully!" -ForegroundColor Green
Write-Host "  - Certificate: $CERT_FILE"
Write-Host "  - Private Key: $KEY_FILE"
Write-Host ""
Write-Host "These certificates are valid for 365 days." -ForegroundColor Cyan
Write-Host "⚠️  WARNING: These are self-signed certificates for development only." -ForegroundColor Yellow
Write-Host "    Your browser will show a security warning - this is expected." -ForegroundColor Yellow
