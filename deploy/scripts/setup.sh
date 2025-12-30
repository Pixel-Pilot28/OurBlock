#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock Edge Node - Quick Setup Script
#
# One-command setup for new neighborhood nodes
# Works on Raspberry Pi, Mini PCs, and Proxmox containers
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ourblock/ourblock/main/deploy/scripts/setup.sh | bash
# 
# Or download and run:
#   ./setup.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
INSTALL_DIR="${INSTALL_DIR:-$HOME/ourblock}"
COMPOSE_PROJECT="ourblock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                         OurBlock Edge Node Setup"
echo "                    Decentralized Neighborhood Community"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# ─────────────────────────────────────────────────────────────────────────────────
# Check Prerequisites
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${YELLOW}→ Checking prerequisites...${NC}"

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}  ✗ Docker is not installed${NC}"
    echo ""
    echo "  Please install Docker first:"
    echo "    curl -fsSL https://get.docker.com | sh"
    echo "    sudo usermod -aG docker \$USER"
    echo ""
    exit 1
fi
echo -e "${GREEN}  ✓ Docker installed${NC}"

# Check for Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}  ✗ Docker Compose is not installed${NC}"
    echo ""
    echo "  Please install Docker Compose plugin:"
    echo "    sudo apt-get update"
    echo "    sudo apt-get install docker-compose-plugin"
    echo ""
    exit 1
fi
echo -e "${GREEN}  ✓ Docker Compose installed${NC}"

# Check Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}  ✗ Docker daemon is not running${NC}"
    echo ""
    echo "  Start Docker with: sudo systemctl start docker"
    exit 1
fi
echo -e "${GREEN}  ✓ Docker daemon running${NC}"

# ─────────────────────────────────────────────────────────────────────────────────
# Create Installation Directory
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}→ Setting up OurBlock in ${INSTALL_DIR}...${NC}"

mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

# ─────────────────────────────────────────────────────────────────────────────────
# Download Configuration Files
# ─────────────────────────────────────────────────────────────────────────────────

echo -e "${YELLOW}→ Downloading configuration files...${NC}"

# In a real deployment, these would be downloaded from a release URL
# For now, we create them inline

cat > docker-compose.yaml << 'EOF'
# OurBlock Edge Node - Docker Compose Configuration
# See: https://github.com/ourblock/ourblock for full documentation

services:
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

  ourblock:
    image: ourblock/edge-node:latest
    container_name: ourblock-conductor
    restart: unless-stopped
    depends_on:
      - lair-keystore
    ports:
      - "8001:8001"
      - "8888:8888"
    volumes:
      - conductor_data:/data
      - conductor_config:/config
    environment:
      - RUST_LOG=info
      - LAIR_KEYSTORE_URL=lair://lair-keystore:50000
    networks:
      - ourblock-network

  ui:
    image: nginx:alpine
    container_name: ourblock-ui
    restart: unless-stopped
    depends_on:
      - ourblock
    ports:
      - "3000:80"
    networks:
      - ourblock-network

networks:
  ourblock-network:
    driver: bridge

volumes:
  lair_data:
  conductor_data:
  conductor_config:
EOF

echo -e "${GREEN}  ✓ Configuration files created${NC}"

# ─────────────────────────────────────────────────────────────────────────────────
# Generate Lair Passphrase
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}→ Generating secure passphrase...${NC}"

# Generate a random passphrase for the keystore
PASSPHRASE=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
echo "${PASSPHRASE}" > .lair_passphrase
chmod 600 .lair_passphrase

echo -e "${GREEN}  ✓ Passphrase generated and saved${NC}"
echo -e "${YELLOW}  ⚠ IMPORTANT: Back up .lair_passphrase securely!${NC}"

# ─────────────────────────────────────────────────────────────────────────────────
# Pull Images
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}→ Pulling Docker images (this may take a while)...${NC}"

docker compose pull

echo -e "${GREEN}  ✓ Images pulled${NC}"

# ─────────────────────────────────────────────────────────────────────────────────
# Start Services
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}→ Starting OurBlock services...${NC}"

docker compose up -d

echo -e "${GREEN}  ✓ Services started${NC}"

# ─────────────────────────────────────────────────────────────────────────────────
# Complete!
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    OurBlock Edge Node is Running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Access the OurBlock UI at:"
echo -e "    ${BLUE}http://localhost:3000${NC}"
echo ""
echo "  Useful commands:"
echo "    View logs:     cd ${INSTALL_DIR} && docker compose logs -f"
echo "    Stop:          cd ${INSTALL_DIR} && docker compose down"
echo "    Restart:       cd ${INSTALL_DIR} && docker compose restart"
echo "    Update:        cd ${INSTALL_DIR} && docker compose pull && docker compose up -d"
echo ""
echo -e "${YELLOW}  ⚠ Remember to back up your .lair_passphrase file!${NC}"
echo ""
