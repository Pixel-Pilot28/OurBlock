#!/usr/bin/env bash
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# OurBlock - Local Development Testing
#
# This script starts a local Holochain sandbox with your hApp for testing.
# Run the UI dev server separately with `cd ui && npm run dev`
#
# Usage:
#   ./test-local.sh
#
# Prerequisites:
#   - Nix with Holonix flake
#   - Built hApp at workdir/our_block.happ
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘           OurBlock - Local Development Testing                â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo -e "${NC}"

# Check if hApp exists
if [ ! -f "workdir/our_block.happ" ]; then
    echo -e "${YELLOW}⚠${NC} hApp not found. Building..."
    # RUSTFLAGS required for getrandom 0.3 WASM compatibility
    export RUSTFLAGS='--cfg getrandom_backend="custom"'
    cargo build --release --target wasm32-unknown-unknown
    hc dna pack dnas/our_block/workdir -o dnas/our_block/workdir/our_block.dna
    hc app pack workdir -o workdir/our_block.happ
fi

echo -e "${GREEN}âœ“${NC} hApp found: workdir/our_block.happ"

# Clean old sandbox data
echo -e "${BLUE}â†’${NC} Cleaning old sandbox data..."
rm -rf .hc_sandbox 2>/dev/null || true

echo ""
echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
echo -e "${BLUE}  Starting Holochain Sandbox...${NC}"
echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
echo ""
echo "  App WebSocket will be available at: ws://localhost:8888"
echo "  Admin WebSocket at: ws://localhost:8000"
echo ""
echo -e "  ${CYAN}In another terminal, run:${NC}"
echo "    cd ui && npm install && npm run dev"
echo ""
echo "  Then open: http://localhost:5173"
echo ""
echo -e "${YELLOW}  Press Ctrl+C to stop the sandbox${NC}"
echo ""

# Start sandbox (run directly if already in nix shell, otherwise use nix develop)
if command -v holochain &> /dev/null; then
    hc sandbox generate workdir/our_block.happ \
        --run=8888 \
        --directories=.hc_sandbox \
        -a our_block
else
    nix develop -c hc sandbox generate workdir/our_block.happ \
        --run=8888 \
        --directories=.hc_sandbox \
        -a our_block
fi
