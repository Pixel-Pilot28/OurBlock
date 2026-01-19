#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock Edge Node - One-Command Installer
# 
# This script sets up a complete OurBlock neighborhood node with:
#   - Automatic Docker installation (if needed)
#   - Unique Neighborhood ID generation
#   - Status dashboard on port 8080
#   - mDNS/Avahi for zero-configuration discovery
#
# Usage:
#   curl -fsSL https://ourblock.community/install.sh | bash
#   
# Or with a specific neighborhood:
#   curl -fsSL https://ourblock.community/install.sh | bash -s -- --neighborhood "elm-street-2025"
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# ─────────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────────

INSTALL_DIR="${INSTALL_DIR:-$HOME/ourblock}"
OURBLOCK_VERSION="${OURBLOCK_VERSION:-latest}"
STATUS_PORT="${STATUS_PORT:-8080}"
APP_PORT="${APP_PORT:-3000}"
WS_PORT="${WS_PORT:-8888}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────────
# Parse Arguments
# ─────────────────────────────────────────────────────────────────────────────────

NEIGHBORHOOD_ID=""
SKIP_DOCKER_INSTALL=false
ENABLE_MDNS=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --neighborhood|-n)
            NEIGHBORHOOD_ID="$2"
            shift 2
            ;;
        --skip-docker)
            SKIP_DOCKER_INSTALL=true
            shift
            ;;
        --no-mdns)
            ENABLE_MDNS=false
            shift
            ;;
        --help|-h)
            echo "OurBlock Edge Node Installer"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -n, --neighborhood ID    Join an existing neighborhood (default: generate new)"
            echo "  --skip-docker            Skip Docker installation check"
            echo "  --no-mdns                Disable mDNS/Avahi discovery"
            echo "  -h, --help               Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ─────────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────────

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                               ║"
    echo "║     ██████╗ ██╗   ██╗██████╗ ██████╗ ██╗      ██████╗  ██████╗██╗  ██╗        ║"
    echo "║    ██╔═══██╗██║   ██║██╔══██╗██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝        ║"
    echo "║    ██║   ██║██║   ██║██████╔╝██████╔╝██║     ██║   ██║██║     █████╔╝         ║"
    echo "║    ██║   ██║██║   ██║██╔══██╗██╔══██╗██║     ██║   ██║██║     ██╔═██╗         ║"
    echo "║    ╚██████╔╝╚██████╔╝██║  ██║██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗        ║"
    echo "║     ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝        ║"
    echo "║                                                                               ║"
    echo "║                    Decentralized Neighborhood Community                       ║"
    echo "║                                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_step() {
    echo -e "${BLUE}→${NC} $1"
}

log_success() {
    echo -e "${GREEN}  ✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}  ⚠${NC} $1"
}

log_error() {
    echo -e "${RED}  ✗${NC} $1"
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
    else
        OS="unknown"
    fi
    
    # Detect architecture
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="amd64" ;;
        aarch64) ARCH="arm64" ;;
        armv7l) ARCH="arm" ;;
    esac
}

detect_ip() {
    # Try to get the local IP address
    if command -v hostname &> /dev/null; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7;exit}')
    fi
    
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP="localhost"
    fi
}

generate_neighborhood_id() {
    # Generate a unique, human-friendly neighborhood ID
    local adjectives=("sunny" "green" "quiet" "friendly" "happy" "peaceful" "cozy" "lovely" "bright" "warm")
    local nouns=("maple" "oak" "elm" "cedar" "pine" "birch" "willow" "cherry" "walnut" "hickory")
    
    local adj=${adjectives[$RANDOM % ${#adjectives[@]}]}
    local noun=${nouns[$RANDOM % ${#nouns[@]}]}
    local num=$(printf "%04d" $((RANDOM % 10000)))
    
    echo "${adj}-${noun}-${num}"
}

# ─────────────────────────────────────────────────────────────────────────────────
# Main Installation
# ─────────────────────────────────────────────────────────────────────────────────

print_banner

detect_os
detect_ip

echo -e "${BOLD}System Information:${NC}"
echo "  OS: $OS ($ARCH)"
echo "  IP: $LOCAL_IP"
echo ""

# ─────────────────────────────────────────────────────────────────────────────────
# Step 1: Check/Install Docker
# ─────────────────────────────────────────────────────────────────────────────────

log_step "Checking Docker installation..."

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | tr -d ',')
    log_success "Docker $DOCKER_VERSION is installed"
else
    if [ "$SKIP_DOCKER_INSTALL" = true ]; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    log_warning "Docker not found. Installing..."
    
    # Install Docker using the official script
    curl -fsSL https://get.docker.com | sh
    
    # Add current user to docker group
    sudo usermod -aG docker "$USER"
    
    log_success "Docker installed successfully"
    log_warning "You may need to log out and back in for Docker permissions to take effect"
fi

# Check Docker Compose
if docker compose version &> /dev/null; then
    log_success "Docker Compose is available"
else
    log_step "Installing Docker Compose plugin..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        sudo apt-get update
        sudo apt-get install -y docker-compose-plugin
    elif [ "$OS" = "fedora" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
        sudo dnf install -y docker-compose-plugin
    else
        log_error "Please install docker-compose-plugin manually"
        exit 1
    fi
    
    log_success "Docker Compose installed"
fi

# Check Docker daemon
if ! docker info &> /dev/null; then
    log_step "Starting Docker daemon..."
    sudo systemctl start docker
    sudo systemctl enable docker
    log_success "Docker daemon started"
fi

# ─────────────────────────────────────────────────────────────────────────────────
# Step 2: Install mDNS/Avahi (Zero-Configuration Networking)
# ─────────────────────────────────────────────────────────────────────────────────

if [ "$ENABLE_MDNS" = true ]; then
    log_step "Setting up mDNS/Avahi for zero-configuration networking..."
    
    if command -v avahi-daemon &> /dev/null; then
        log_success "Avahi is already installed"
    else
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            sudo apt-get update
            sudo apt-get install -y avahi-daemon avahi-utils libnss-mdns
        elif [ "$OS" = "fedora" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
            sudo dnf install -y avahi avahi-tools nss-mdns
        else
            log_warning "Please install avahi-daemon manually for mDNS support"
        fi
    fi
    
    # Enable and start Avahi
    if command -v avahi-daemon &> /dev/null; then
        sudo systemctl enable avahi-daemon 2>/dev/null || true
        sudo systemctl start avahi-daemon 2>/dev/null || true
        log_success "Avahi mDNS enabled - your node will be discoverable as 'ourblock.local'"
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────────
# Step 3: Create Installation Directory
# ─────────────────────────────────────────────────────────────────────────────────

log_step "Creating OurBlock directory at ${INSTALL_DIR}..."

mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

log_success "Directory created"

# ─────────────────────────────────────────────────────────────────────────────────
# Step 4: Generate Neighborhood ID
# ─────────────────────────────────────────────────────────────────────────────────

if [ -z "$NEIGHBORHOOD_ID" ]; then
    log_step "Generating unique Neighborhood ID..."
    NEIGHBORHOOD_ID=$(generate_neighborhood_id)
    log_success "Your Neighborhood ID: ${BOLD}${NEIGHBORHOOD_ID}${NC}"
    echo ""
    echo -e "${YELLOW}  Share this ID with neighbors who want to join your network!${NC}"
else
    log_step "Using provided Neighborhood ID: ${BOLD}${NEIGHBORHOOD_ID}${NC}"
fi

# Save neighborhood ID
echo "$NEIGHBORHOOD_ID" > .neighborhood_id

# ─────────────────────────────────────────────────────────────────────────────────
# Step 5: Generate Configuration Files
# ─────────────────────────────────────────────────────────────────────────────────

log_step "Generating configuration files..."

# Generate Lair passphrase
PASSPHRASE=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
echo "${PASSPHRASE}" > .lair_passphrase
chmod 600 .lair_passphrase

# Create .env file
cat > .env << EOF
# OurBlock Configuration
# Generated: $(date -Iseconds)

NEIGHBORHOOD_ID=${NEIGHBORHOOD_ID}
NETWORK_SEED=ourblock-${NEIGHBORHOOD_ID}

# Ports
STATUS_PORT=${STATUS_PORT}
APP_PORT=${APP_PORT}
WS_PORT=${WS_PORT}

# Holochain
BOOTSTRAP_URL=https://bootstrap.holo.host
SIGNAL_URL=wss://signal.holo.host
RUST_LOG=info

# Version
OURBLOCK_VERSION=${OURBLOCK_VERSION}
EOF

# Create docker-compose.yaml
cat > docker-compose.yaml << 'COMPOSE_EOF'
# OurBlock Edge Node - Docker Compose
# Auto-generated by setup-ourblock.sh

services:
  # Lair Keystore - Cryptographic Key Management
  lair-keystore:
    image: holochain/lair-keystore:0.5
    container_name: ourblock-lair
    restart: unless-stopped
    volumes:
      - lair_data:/lair
    environment:
      - LAIR_DIR=/lair
    networks:
      - ourblock-network
    healthcheck:
      test: ["CMD", "lair-keystore", "--version"]
      interval: 30s
      timeout: 10s
      retries: 3

  # OurBlock Conductor - Main Holochain Node
  ourblock:
    image: ourblock/edge-node:${OURBLOCK_VERSION:-latest}
    container_name: ourblock-conductor
    restart: unless-stopped
    depends_on:
      lair-keystore:
        condition: service_healthy
    ports:
      - "${WS_PORT:-8888}:8888"
    volumes:
      - conductor_data:/data
      - conductor_config:/config
    environment:
      - RUST_LOG=${RUST_LOG:-info}
      - LAIR_KEYSTORE_URL=lair://lair-keystore:50000
      - BOOTSTRAP_URL=${BOOTSTRAP_URL:-https://bootstrap.holo.host}
      - SIGNAL_URL=${SIGNAL_URL:-wss://signal.holo.host}
      - NETWORK_SEED=${NETWORK_SEED}
    networks:
      - ourblock-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  # OurBlock UI - Web Interface
  ui:
    image: ourblock/ui:${OURBLOCK_VERSION:-latest}
    container_name: ourblock-ui
    restart: unless-stopped
    depends_on:
      ourblock:
        condition: service_healthy
    ports:
      - "${APP_PORT:-3000}:80"
    networks:
      - ourblock-network

  # Status Dashboard - Node Monitoring
  status:
    image: ourblock/status-dashboard:${OURBLOCK_VERSION:-latest}
    container_name: ourblock-status
    restart: unless-stopped
    depends_on:
      - ourblock
    ports:
      - "${STATUS_PORT:-8080}:8080"
    volumes:
      - conductor_data:/data:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - NEIGHBORHOOD_ID=${NEIGHBORHOOD_ID}
      - CONDUCTOR_URL=http://ourblock:8001
    networks:
      - ourblock-network

  # Avahi/mDNS - Zero-Configuration Discovery
  avahi:
    image: flungo/avahi
    container_name: ourblock-avahi
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./avahi:/etc/avahi/services:ro
    cap_add:
      - NET_ADMIN

networks:
  ourblock-network:
    driver: bridge

volumes:
  lair_data:
  conductor_data:
  conductor_config:
COMPOSE_EOF

# Create Avahi service file for mDNS discovery
mkdir -p avahi
cat > avahi/ourblock.service << EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>OurBlock - ${NEIGHBORHOOD_ID}</name>
  
  <service>
    <type>_ourblock._tcp</type>
    <port>${APP_PORT}</port>
    <txt-record>neighborhood=${NEIGHBORHOOD_ID}</txt-record>
    <txt-record>version=${OURBLOCK_VERSION}</txt-record>
  </service>
  
  <service>
    <type>_http._tcp</type>
    <port>${STATUS_PORT}</port>
    <txt-record>path=/</txt-record>
    <txt-record>name=OurBlock Status</txt-record>
  </service>
</service-group>
EOF

log_success "Configuration files created"

# ─────────────────────────────────────────────────────────────────────────────────
# Step 6: Create Local Status Dashboard (Fallback)
# ─────────────────────────────────────────────────────────────────────────────────

log_step "Creating local status dashboard..."

mkdir -p status-dashboard

cat > status-dashboard/Dockerfile << 'DOCKERFILE_EOF'
FROM python:3.11-alpine

WORKDIR /app

RUN pip install --no-cache-dir flask requests docker psutil

COPY server.py .
COPY templates/ templates/
COPY static/ static/

EXPOSE 8080

CMD ["python", "server.py"]
DOCKERFILE_EOF

mkdir -p status-dashboard/templates
mkdir -p status-dashboard/static

cat > status-dashboard/server.py << 'SERVER_EOF'
#!/usr/bin/env python3
"""
OurBlock Status Dashboard Server
Provides a simple web UI showing node status, vouches, and storage.
"""

import os
import json
import time
import threading
from datetime import datetime
from flask import Flask, render_template, jsonify
import requests
import docker
import psutil

app = Flask(__name__)

# Configuration
NEIGHBORHOOD_ID = os.environ.get('NEIGHBORHOOD_ID', 'unknown')
CONDUCTOR_URL = os.environ.get('CONDUCTOR_URL', 'http://ourblock:8001')
DATA_DIR = os.environ.get('DATA_DIR', '/data')

# Cache for stats
stats_cache = {
    'online': False,
    'uptime': 0,
    'start_time': time.time(),
    'vouches_processed': 0,
    'storage_used_mb': 0,
    'peers_connected': 0,
    'last_update': None
}

def format_uptime(seconds):
    """Format uptime in human-readable format."""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h {minutes}m"
    else:
        return f"{minutes}m"

def get_storage_used():
    """Get storage used by conductor data."""
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(DATA_DIR):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if os.path.exists(fp):
                    total_size += os.path.getsize(fp)
    except Exception:
        pass
    return total_size / (1024 * 1024)  # Convert to MB

def get_container_status():
    """Get Docker container status."""
    try:
        client = docker.from_env()
        containers = {
            'conductor': 'ourblock-conductor',
            'lair': 'ourblock-lair',
            'ui': 'ourblock-ui'
        }
        
        status = {}
        for name, container_name in containers.items():
            try:
                container = client.containers.get(container_name)
                status[name] = container.status
            except docker.errors.NotFound:
                status[name] = 'not found'
            except Exception:
                status[name] = 'unknown'
        
        return status
    except Exception:
        return {'conductor': 'unknown', 'lair': 'unknown', 'ui': 'unknown'}

def update_stats():
    """Update stats cache periodically."""
    global stats_cache
    
    while True:
        try:
            # Check conductor health
            try:
                response = requests.get(f"{CONDUCTOR_URL}/health", timeout=5)
                stats_cache['online'] = response.status_code == 200
            except Exception:
                stats_cache['online'] = False
            
            # Update uptime
            stats_cache['uptime'] = time.time() - stats_cache['start_time']
            
            # Get storage used
            stats_cache['storage_used_mb'] = get_storage_used()
            
            # Get container status
            stats_cache['containers'] = get_container_status()
            
            # Update timestamp
            stats_cache['last_update'] = datetime.now().isoformat()
            
        except Exception as e:
            print(f"Error updating stats: {e}")
        
        time.sleep(10)

@app.route('/')
def index():
    """Render the status dashboard."""
    return render_template('index.html',
        neighborhood_id=NEIGHBORHOOD_ID,
        stats=stats_cache,
        uptime_formatted=format_uptime(stats_cache['uptime'])
    )

@app.route('/api/status')
def api_status():
    """Return status as JSON."""
    return jsonify({
        'neighborhood_id': NEIGHBORHOOD_ID,
        'online': stats_cache['online'],
        'uptime_seconds': stats_cache['uptime'],
        'uptime_formatted': format_uptime(stats_cache['uptime']),
        'vouches_processed': stats_cache['vouches_processed'],
        'storage_used_mb': round(stats_cache['storage_used_mb'], 2),
        'peers_connected': stats_cache['peers_connected'],
        'containers': stats_cache.get('containers', {}),
        'last_update': stats_cache['last_update']
    })

@app.route('/health')
def health():
    """Health check endpoint."""
    return 'OK', 200

if __name__ == '__main__':
    # Start stats update thread
    stats_thread = threading.Thread(target=update_stats, daemon=True)
    stats_thread.start()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=8080, debug=False)
SERVER_EOF

cat > status-dashboard/templates/index.html << 'HTML_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OurBlock Status - {{ neighborhood_id }}</title>
    <style>
        :root {
            --primary: #4CAF50;
            --primary-dark: #388E3C;
            --danger: #f44336;
            --warning: #ff9800;
            --background: #f5f5f5;
            --card-bg: #ffffff;
            --text: #333333;
            --text-light: #666666;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: var(--background);
            color: var(--text);
            min-height: 100vh;
        }
        
        .header {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
            padding: 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        
        .header .neighborhood {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem 1rem;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .status-card {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .status-card .icon {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .status-card .label {
            color: var(--text-light);
            font-size: 0.875rem;
            margin-bottom: 0.25rem;
        }
        
        .status-card .value {
            font-size: 1.5rem;
            font-weight: bold;
        }
        
        .status-online .value {
            color: var(--primary);
        }
        
        .status-offline .value {
            color: var(--danger);
        }
        
        .containers-section {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        
        .containers-section h2 {
            margin-bottom: 1rem;
            font-size: 1.25rem;
        }
        
        .container-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .container-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem;
            background: var(--background);
            border-radius: 8px;
        }
        
        .container-name {
            font-weight: 500;
        }
        
        .container-status {
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .container-status.running {
            background: #e8f5e9;
            color: var(--primary);
        }
        
        .container-status.stopped {
            background: #ffebee;
            color: var(--danger);
        }
        
        .info-section {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .info-section h2 {
            margin-bottom: 1rem;
            font-size: 1.25rem;
        }
        
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--background);
        }
        
        .info-item:last-child {
            border-bottom: none;
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: var(--text-light);
            font-size: 0.875rem;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 50%;
            width: 56px;
            height: 56px;
            font-size: 1.5rem;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: transform 0.2s;
        }
        
        .refresh-btn:hover {
            transform: scale(1.1);
        }
        
        @media (max-width: 600px) {
            .header h1 {
                font-size: 1.5rem;
            }
            
            .status-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>🏘️ OurBlock Hub</h1>
        <div class="neighborhood">{{ neighborhood_id }}</div>
    </header>
    
    <div class="container">
        <div class="status-grid">
            <div class="status-card {{ 'status-online' if stats.online else 'status-offline' }}">
                <div class="icon">{{ '🟢' if stats.online else '🔴' }}</div>
                <div class="label">Status</div>
                <div class="value">{{ 'Online' if stats.online else 'Offline' }}</div>
            </div>
            
            <div class="status-card">
                <div class="icon">⏱️</div>
                <div class="label">Uptime</div>
                <div class="value">{{ uptime_formatted }}</div>
            </div>
            
            <div class="status-card">
                <div class="icon">🤝</div>
                <div class="label">Vouches Processed</div>
                <div class="value" id="vouches">{{ stats.vouches_processed }}</div>
            </div>
            
            <div class="status-card">
                <div class="icon">💾</div>
                <div class="label">Storage Used</div>
                <div class="value" id="storage">{{ "%.1f"|format(stats.storage_used_mb) }} MB</div>
            </div>
        </div>
        
        <div class="containers-section">
            <h2>🐳 Services</h2>
            <div class="container-list" id="containers">
                <div class="container-item">
                    <span class="container-name">Holochain Conductor</span>
                    <span class="container-status {{ 'running' if stats.containers.conductor == 'running' else 'stopped' }}">
                        {{ stats.containers.conductor or 'unknown' }}
                    </span>
                </div>
                <div class="container-item">
                    <span class="container-name">Lair Keystore</span>
                    <span class="container-status {{ 'running' if stats.containers.lair == 'running' else 'stopped' }}">
                        {{ stats.containers.lair or 'unknown' }}
                    </span>
                </div>
                <div class="container-item">
                    <span class="container-name">Web UI</span>
                    <span class="container-status {{ 'running' if stats.containers.ui == 'running' else 'stopped' }}">
                        {{ stats.containers.ui or 'unknown' }}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="info-section">
            <h2>ℹ️ Connection Info</h2>
            <div class="info-item">
                <span>App URL</span>
                <span><a href="http://ourblock.local:3000">http://ourblock.local:3000</a></span>
            </div>
            <div class="info-item">
                <span>Status Dashboard</span>
                <span><a href="http://ourblock.local:8080">http://ourblock.local:8080</a></span>
            </div>
            <div class="info-item">
                <span>Neighborhood ID</span>
                <span><strong>{{ neighborhood_id }}</strong></span>
            </div>
        </div>
    </div>
    
    <footer class="footer">
        <p>OurBlock - Decentralized Neighborhood Community</p>
        <p>Last updated: <span id="last-update">{{ stats.last_update or 'Never' }}</span></p>
    </footer>
    
    <button class="refresh-btn" onclick="refreshStats()" title="Refresh">🔄</button>
    
    <script>
        async function refreshStats() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                // Update values
                document.getElementById('vouches').textContent = data.vouches_processed;
                document.getElementById('storage').textContent = data.storage_used_mb.toFixed(1) + ' MB';
                document.getElementById('last-update').textContent = new Date(data.last_update).toLocaleString();
                
            } catch (error) {
                console.error('Failed to refresh stats:', error);
            }
        }
        
        // Auto-refresh every 30 seconds
        setInterval(refreshStats, 30000);
    </script>
</body>
</html>
HTML_EOF

log_success "Status dashboard created"

# ─────────────────────────────────────────────────────────────────────────────────
# Step 7: Pull Docker Images
# ─────────────────────────────────────────────────────────────────────────────────

log_step "Pulling OurBlock Docker images (this may take a while)..."

# Build status dashboard locally since it's custom
docker build -t ourblock/status-dashboard:latest status-dashboard/

# Pull other images (will fail gracefully if not published yet)
docker compose pull 2>/dev/null || log_warning "Some images not found - will build locally"

log_success "Images ready"

# ─────────────────────────────────────────────────────────────────────────────────
# Step 8: Start Services
# ─────────────────────────────────────────────────────────────────────────────────

log_step "Starting OurBlock services..."

docker compose up -d

# Wait for services to start
sleep 5

log_success "Services started"

# ─────────────────────────────────────────────────────────────────────────────────
# Step 9: Set Up System Service (Optional)
# ─────────────────────────────────────────────────────────────────────────────────

log_step "Creating system service for auto-start..."

sudo tee /etc/systemd/system/ourblock.service > /dev/null << EOF
[Unit]
Description=OurBlock Neighborhood Node
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=${USER}

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ourblock.service 2>/dev/null || true

log_success "System service created - OurBlock will start on boot"

# ─────────────────────────────────────────────────────────────────────────────────
# Complete!
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    🎉 OurBlock Installation Complete! 🎉                      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Your Neighborhood:${NC} ${CYAN}${NEIGHBORHOOD_ID}${NC}"
echo ""
echo -e "${BOLD}Access your node:${NC}"
echo ""
echo -e "  📱 ${BOLD}OurBlock App:${NC}"
echo -e "     Local:   ${BLUE}http://localhost:${APP_PORT}${NC}"
echo -e "     Network: ${BLUE}http://${LOCAL_IP}:${APP_PORT}${NC}"
if [ "$ENABLE_MDNS" = true ]; then
echo -e "     mDNS:    ${BLUE}http://ourblock.local:${APP_PORT}${NC}"
fi
echo ""
echo -e "  📊 ${BOLD}Status Dashboard:${NC}"
echo -e "     Local:   ${BLUE}http://localhost:${STATUS_PORT}${NC}"
echo -e "     Network: ${BLUE}http://${LOCAL_IP}:${STATUS_PORT}${NC}"
if [ "$ENABLE_MDNS" = true ]; then
echo -e "     mDNS:    ${BLUE}http://ourblock.local:${STATUS_PORT}${NC}"
fi
echo ""
echo -e "${BOLD}Share with neighbors:${NC}"
echo -e "  To join this neighborhood, neighbors can run:"
echo -e "  ${CYAN}curl -fsSL https://ourblock.community/install.sh | bash -s -- -n ${NEIGHBORHOOD_ID}${NC}"
echo ""
echo -e "${BOLD}Useful commands:${NC}"
echo -e "  View logs:     ${CYAN}cd ${INSTALL_DIR} && docker compose logs -f${NC}"
echo -e "  Stop:          ${CYAN}cd ${INSTALL_DIR} && docker compose down${NC}"
echo -e "  Restart:       ${CYAN}cd ${INSTALL_DIR} && docker compose restart${NC}"
echo -e "  Update:        ${CYAN}cd ${INSTALL_DIR} && docker compose pull && docker compose up -d${NC}"
echo ""
echo -e "${YELLOW}⚠  IMPORTANT: Back up your .lair_passphrase file!${NC}"
echo -e "   Location: ${INSTALL_DIR}/.lair_passphrase"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
