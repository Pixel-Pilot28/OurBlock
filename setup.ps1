# OurBlock Quick Setup Script (Windows PowerShell)
# This script helps you get started with OurBlock development

Write-Host "🏘️  OurBlock Setup Script (Windows)" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Function to print colored output
function Show-Step {
    param([string]$message)
    Write-Host "▶ $message" -ForegroundColor Blue
}

function Show-Success {
    param([string]$message)
    Write-Host "✓ $message" -ForegroundColor Green
}

function Show-Warning {
    param([string]$message)
    Write-Host "⚠ $message" -ForegroundColor Yellow
}

function Show-Error {
    param([string]$message)
    Write-Host "❌ $message" -ForegroundColor Red
}

# Check for WSL2
Show-Step "Checking for WSL2..."
try {
    $null = wsl --status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Show-Error "WSL2 not found or not running!"
        Write-Host ""
        Write-Host "OurBlock development requires WSL2 with Nix."
        Write-Host ""
        Write-Host "To set up WSL2:"
        Write-Host "  1. Open PowerShell as Administrator"
        Write-Host "  2. Run: wsl --install"
        Write-Host "  3. Restart your computer"
        Write-Host "  4. Install Nix inside WSL: curl -L https://nixos.org/nix/install | sh"
        Write-Host ""
        Write-Host "Then run this script again from within WSL:"
        Write-Host "  wsl"
        Write-Host "  cd /mnt/c/.../OurBlock"
        Write-Host "  nix develop"
        Write-Host "  bash setup.sh"
        exit 1
    }
    Show-Success "WSL2 is available"
} catch {
    Show-Error "Could not check WSL2 status"
    exit 1
}

# Show menu
Write-Host ""
Write-Host "What would you like to do?"
Write-Host "  1) Enter WSL2 and run setup (Recommended)"
Write-Host "  2) Start Docker Compose Hub (Windows Docker Desktop)"
Write-Host "  3) Install UI dependencies only (Node.js required)"
Write-Host "  4) View documentation"
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    "1" {
        Show-Step "Launching WSL2..."
        Write-Host ""
        Write-Host "You'll be dropped into a WSL2 shell."
        Write-Host "From there, run:"
        Write-Host "  cd /mnt/c/.../OurBlock  # Adjust path to your project"
        Write-Host "  nix develop"
        Write-Host "  bash setup.sh"
        Write-Host ""
        wsl
    }
    
    "2" {
        Show-Step "Starting Docker Compose Hub..."
        
        # Check for Docker Desktop
        $null = docker --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Show-Error "Docker not found!"
            Write-Host ""
            Write-Host "Please install Docker Desktop for Windows:"
            Write-Host "  https://www.docker.com/products/docker-desktop"
            exit 1
        }
        Show-Success "Docker is installed"
        
        # Check if docker-compose.yml exists
        if (-Not (Test-Path "docker-compose.yml")) {
            Show-Error "docker-compose.yml not found in current directory!"
            Write-Host "Make sure you're in the OurBlock project root."
            exit 1
        }
        
        Show-Step "Starting containers..."
        docker-compose up -d
        
        if ($LASTEXITCODE -eq 0) {
            Show-Success "Hub is running!"
            Write-Host ""
            Write-Host "Hub is now accessible at:"
            Write-Host "  http://localhost"
            Write-Host ""
            Write-Host "To view logs:"
            Write-Host "  docker-compose logs -f"
            Write-Host ""
            Write-Host "To stop:"
            Write-Host "  docker-compose down"
        } else {
            Show-Error "Failed to start containers"
            Write-Host "Check docker-compose logs for errors:"
            Write-Host "  docker-compose logs"
        }
    }
    
    "3" {
        Show-Step "Installing UI dependencies..."
        
        # Check for Node.js
        $null = node --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Show-Error "Node.js not found!"
            Write-Host ""
            Write-Host "Please install Node.js first:"
            Write-Host "  https://nodejs.org/ (LTS version recommended)"
            exit 1
        }
        Show-Success "Node.js is installed ($(node --version))"
        
        if (-Not (Test-Path "ui")) {
            Show-Error "ui directory not found!"
            exit 1
        }
        
        Set-Location ui
        npm install
        
        if ($LASTEXITCODE -eq 0) {
            Show-Success "Dependencies installed!"
            Write-Host ""
            Write-Host "To start the development server:"
            Write-Host "  cd ui"
            Write-Host "  npm run dev"
            Write-Host ""
            Write-Host "Note: You'll also need the Hub running (see option 2)"
        } else {
            Show-Error "Failed to install dependencies"
        }
        Set-Location ..
    }
    
    "4" {
        Show-Step "Opening documentation..."
        Write-Host ""
        Write-Host "Documentation files:"
        Write-Host "  README.md                          - Main project overview"
        Write-Host "  docs/ARCHITECTURE.md               - System architecture"
        Write-Host "  docs/INVITATION_SYSTEM.md          - Invite code system"
        Write-Host "  docs/TESTING_JOIN_FLOW.md          - Testing guide"
        Write-Host "  docs/TASK_C_COMPLETE.md            - Task C completion summary"
        Write-Host "  docs/QUICK_REFERENCE.md            - Command reference"
        Write-Host "  docs/ROADMAP.md                    - Feature roadmap"
        Write-Host ""
        Write-Host "Deployment guides:"
        Write-Host "  docs/HOME_ASSISTANT_DEPLOYMENT.md  - Home Assistant setup"
        Write-Host "  DEPLOYMENT.md                      - Holochain Launcher"
        Write-Host ""
        
        $openDocs = Read-Host "Open README.md in browser? (y/n)"
        if ($openDocs -eq "y") {
            if (Test-Path "README.md") {
                Start-Process "README.md"
            } else {
                Write-Host "README.md not found in current directory"
            }
        }
    }
    
    default {
        Show-Error "Invalid choice. Exiting."
        exit 1
    }
}

Write-Host ""
Show-Success "Done! 🎉"
Write-Host ""
Write-Host "For development with full Holochain tooling, use WSL2 + Nix (option 1)"
Write-Host "For quick testing with Docker, use option 2"
Write-Host ""
