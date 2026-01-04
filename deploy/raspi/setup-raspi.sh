#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock - Raspberry Pi Setup Script
#
# Optimized setup for Raspberry Pi 4/5 running Raspberry Pi OS (64-bit)
#
# Usage:
#   curl -fsSL https://ourblock.community/raspi.sh | bash
#
# Requirements:
#   - Raspberry Pi 4 (4GB+) or Raspberry Pi 5
#   - Raspberry Pi OS Lite (64-bit) recommended
#   - 32GB+ SD card or SSD
#   - Internet connection
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         OurBlock - Raspberry Pi Setup                         ║"
echo "║         Decentralized Neighborhood Community                  ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────────────────────────────────────────────
# Check System
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}→${NC} Checking system..."

# Check architecture
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ]; then
    echo -e "${YELLOW}⚠${NC} Warning: Not running on 64-bit ARM. Some features may not work."
fi

# Check if running on Raspberry Pi
if [ -f /proc/device-tree/model ]; then
    MODEL=$(cat /proc/device-tree/model)
    echo -e "${GREEN}✓${NC} Detected: $MODEL"
else
    echo -e "${YELLOW}⚠${NC} Not running on Raspberry Pi, but continuing anyway..."
fi

# Check memory
MEM_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
MEM_GB=$((MEM_TOTAL / 1024 / 1024))
if [ "$MEM_GB" -lt 3 ]; then
    echo -e "${YELLOW}⚠${NC} Only ${MEM_GB}GB RAM detected. 4GB+ recommended."
fi

# ─────────────────────────────────────────────────────────────────────────────────
# System Optimization
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}→${NC} Optimizing system for OurBlock..."

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install useful tools
sudo apt-get install -y \
    curl \
    wget \
    git \
    htop \
    avahi-daemon \
    avahi-utils

# Enable zswap for better memory management
if ! grep -q "zswap.enabled=1" /boot/cmdline.txt 2>/dev/null; then
    echo -e "${BLUE}→${NC} Enabling zswap for better memory performance..."
    sudo sed -i 's/$/ zswap.enabled=1 zswap.compressor=lz4/' /boot/cmdline.txt 2>/dev/null || true
fi

# Increase swap if needed
SWAP_SIZE=$(free -m | grep Swap | awk '{print $2}')
if [ "$SWAP_SIZE" -lt 2000 ]; then
    echo -e "${BLUE}→${NC} Increasing swap to 2GB..."
    sudo dphys-swapfile swapoff 2>/dev/null || true
    sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile 2>/dev/null || true
    sudo dphys-swapfile setup 2>/dev/null || true
    sudo dphys-swapfile swapon 2>/dev/null || true
fi

echo -e "${GREEN}✓${NC} System optimized"

# ─────────────────────────────────────────────────────────────────────────────────
# Install Docker
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}→${NC} Installing Docker..."

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker already installed"
else
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}✓${NC} Docker installed"
fi

# Install docker-compose-plugin
sudo apt-get install -y docker-compose-plugin

# ─────────────────────────────────────────────────────────────────────────────────
# Configure mDNS (Avahi)
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}→${NC} Configuring mDNS discovery..."

# Set hostname to ourblock
sudo hostnamectl set-hostname ourblock

# Create Avahi service file
sudo tee /etc/avahi/services/ourblock.service > /dev/null << 'EOF'
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">OurBlock Hub on %h</name>
  <service>
    <type>_http._tcp</type>
    <port>3000</port>
    <txt-record>path=/</txt-record>
    <txt-record>name=OurBlock</txt-record>
  </service>
  <service>
    <type>_ourblock._tcp</type>
    <port>8888</port>
  </service>
</service-group>
EOF

sudo systemctl restart avahi-daemon
echo -e "${GREEN}✓${NC} mDNS configured - discoverable as ourblock.local"

# ─────────────────────────────────────────────────────────────────────────────────
# Install OurBlock
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}→${NC} Installing OurBlock..."

INSTALL_DIR="/opt/ourblock"
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$USER:$USER" "$INSTALL_DIR"

# Download and run the main setup script
cd "$INSTALL_DIR"
curl -fsSL https://raw.githubusercontent.com/ourblock/ourblock/main/deploy/scripts/setup-ourblock.sh -o setup.sh
chmod +x setup.sh
INSTALL_DIR="$INSTALL_DIR" ./setup.sh --skip-docker

# ─────────────────────────────────────────────────────────────────────────────────
# Create System Service
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}→${NC} Creating system service..."

sudo tee /etc/systemd/system/ourblock.service > /dev/null << EOF
[Unit]
Description=OurBlock Neighborhood Node
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ourblock

echo -e "${GREEN}✓${NC} System service created"

# ─────────────────────────────────────────────────────────────────────────────────
# Get IP Address
# ─────────────────────────────────────────────────────────────────────────────────

IP=$(hostname -I | awk '{print $1}')
NEIGHBORHOOD_ID=$(cat "$INSTALL_DIR/.neighborhood_id" 2>/dev/null || echo "unknown")

# ─────────────────────────────────────────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}        🎉 OurBlock Raspberry Pi Setup Complete! 🎉            ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Neighborhood ID:${NC} $NEIGHBORHOOD_ID"
echo ""
echo "  Access OurBlock from any device on your network:"
echo ""
echo -e "    🌐 Web UI:         ${CYAN}http://ourblock.local:3000${NC}"
echo -e "                       ${CYAN}http://$IP:3000${NC}"
echo ""
echo -e "    📊 Status:         ${CYAN}http://ourblock.local:8080${NC}"
echo -e "                       ${CYAN}http://$IP:8080${NC}"
echo ""
echo "  Invite neighbors to join:"
echo -e "    ${CYAN}curl -fsSL https://ourblock.community/install.sh | bash -s -- -n $NEIGHBORHOOD_ID${NC}"
echo ""
echo -e "${YELLOW}⚠  A reboot is recommended to apply all optimizations${NC}"
echo -e "   Run: ${CYAN}sudo reboot${NC}"
echo ""
