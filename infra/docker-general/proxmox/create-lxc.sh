#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock - Proxmox LXC Container Setup Script
#
# Creates a lightweight LXC container optimized for running OurBlock
# on Proxmox VE. This is more efficient than a full VM.
#
# Usage (run on Proxmox host):
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/ourblock/ourblock/main/deploy/proxmox/create-lxc.sh)"
#
# Or with options:
#   ./create-lxc.sh --id 200 --name ourblock --storage local-lvm
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────────
# Configuration Defaults
# ─────────────────────────────────────────────────────────────────────────────────

CTID="${CTID:-200}"
HOSTNAME="${HOSTNAME:-ourblock}"
STORAGE="${STORAGE:-local-lvm}"
DISK_SIZE="${DISK_SIZE:-16}"
MEMORY="${MEMORY:-2048}"
CORES="${CORES:-2}"
TEMPLATE="${TEMPLATE:-ubuntu-22.04-standard}"
BRIDGE="${BRIDGE:-vmbr0}"
PASSWORD="${PASSWORD:-}"
SSH_KEY="${SSH_KEY:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────────
# Parse Arguments
# ─────────────────────────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
    case $1 in
        --id) CTID="$2"; shift 2 ;;
        --name) HOSTNAME="$2"; shift 2 ;;
        --storage) STORAGE="$2"; shift 2 ;;
        --disk) DISK_SIZE="$2"; shift 2 ;;
        --memory) MEMORY="$2"; shift 2 ;;
        --cores) CORES="$2"; shift 2 ;;
        --bridge) BRIDGE="$2"; shift 2 ;;
        --password) PASSWORD="$2"; shift 2 ;;
        --ssh-key) SSH_KEY="$2"; shift 2 ;;
        --help|-h)
            echo "OurBlock Proxmox LXC Setup"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --id ID           Container ID (default: 200)"
            echo "  --name NAME       Hostname (default: ourblock)"
            echo "  --storage STORE   Storage pool (default: local-lvm)"
            echo "  --disk SIZE       Disk size in GB (default: 16)"
            echo "  --memory MB       Memory in MB (default: 2048)"
            echo "  --cores N         CPU cores (default: 2)"
            echo "  --bridge BRIDGE   Network bridge (default: vmbr0)"
            echo "  --password PASS   Root password"
            echo "  --ssh-key KEY     SSH public key"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ─────────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────────

log() { echo -e "${BLUE}→${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────────
# Preflight Checks
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           OurBlock - Proxmox LXC Container Setup              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running on Proxmox
if ! command -v pct &> /dev/null; then
    error "This script must be run on a Proxmox VE host"
fi

# Check if container ID is available
if pct status "$CTID" &> /dev/null; then
    error "Container ID $CTID already exists. Choose a different ID with --id"
fi

# Generate password if not provided
if [ -z "$PASSWORD" ]; then
    PASSWORD=$(openssl rand -base64 12)
    warn "Generated root password: $PASSWORD"
    echo "  (Save this password - it won't be shown again!)"
fi

echo ""
log "Configuration:"
echo "  Container ID: $CTID"
echo "  Hostname:     $HOSTNAME"
echo "  Storage:      $STORAGE"
echo "  Disk:         ${DISK_SIZE}GB"
echo "  Memory:       ${MEMORY}MB"
echo "  CPU Cores:    $CORES"
echo "  Network:      $BRIDGE (DHCP)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────────
# Download Template
# ─────────────────────────────────────────────────────────────────────────────────

log "Checking for Ubuntu template..."

TEMPLATE_PATH="/var/lib/vz/template/cache/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"

if [ ! -f "$TEMPLATE_PATH" ]; then
    log "Downloading Ubuntu 22.04 template..."
    pveam update
    pveam download local ubuntu-22.04-standard_22.04-1_amd64.tar.zst
fi

success "Template ready"

# ─────────────────────────────────────────────────────────────────────────────────
# Create Container
# ─────────────────────────────────────────────────────────────────────────────────

log "Creating LXC container..."

# Build create command
CREATE_CMD="pct create $CTID $TEMPLATE_PATH"
CREATE_CMD+=" --hostname $HOSTNAME"
CREATE_CMD+=" --storage $STORAGE"
CREATE_CMD+=" --rootfs ${STORAGE}:${DISK_SIZE}"
CREATE_CMD+=" --memory $MEMORY"
CREATE_CMD+=" --cores $CORES"
CREATE_CMD+=" --net0 name=eth0,bridge=$BRIDGE,ip=dhcp"
CREATE_CMD+=" --password $PASSWORD"
CREATE_CMD+=" --features nesting=1,keyctl=1"  # Required for Docker
CREATE_CMD+=" --unprivileged 1"
CREATE_CMD+=" --start 0"

if [ -n "$SSH_KEY" ]; then
    CREATE_CMD+=" --ssh-public-keys $SSH_KEY"
fi

eval "$CREATE_CMD"

success "Container created"

# ─────────────────────────────────────────────────────────────────────────────────
# Start Container and Install OurBlock
# ─────────────────────────────────────────────────────────────────────────────────

log "Starting container..."
pct start "$CTID"
sleep 5

log "Installing Docker and OurBlock..."

pct exec "$CTID" -- bash -c '
    # Update system
    apt-get update
    apt-get upgrade -y
    
    # Install Docker
    curl -fsSL https://get.docker.com | sh
    
    # Install Docker Compose plugin
    apt-get install -y docker-compose-plugin
    
    # Create OurBlock directory
    mkdir -p /opt/ourblock
    cd /opt/ourblock
    
    # Download OurBlock setup
    curl -fsSL https://raw.githubusercontent.com/ourblock/ourblock/main/deploy/scripts/setup-ourblock.sh -o setup.sh
    chmod +x setup.sh
    
    # Run setup (skip Docker install since we just did it)
    INSTALL_DIR=/opt/ourblock ./setup.sh --skip-docker
    
    # Enable on boot
    systemctl enable docker
'

success "OurBlock installed"

# ─────────────────────────────────────────────────────────────────────────────────
# Get IP Address
# ─────────────────────────────────────────────────────────────────────────────────

log "Getting container IP..."
sleep 3

IP=$(pct exec "$CTID" -- hostname -I | awk '{print $1}')

# ─────────────────────────────────────────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           OurBlock LXC Container Ready!                        ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Container ID:    $CTID"
echo "  IP Address:      $IP"
echo ""
echo "  Access OurBlock:"
echo -e "    Web UI:    ${CYAN}http://$IP:3000${NC}"
echo -e "    Status:    ${CYAN}http://$IP:8080${NC}"
echo ""
echo "  SSH Access:"
echo -e "    ${CYAN}ssh root@$IP${NC}"
echo "    Password: $PASSWORD"
echo ""
echo "  Proxmox Console:"
echo -e "    ${CYAN}pct enter $CTID${NC}"
echo ""
