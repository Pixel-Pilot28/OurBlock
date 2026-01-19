#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# OurBlock - Package Script for Holochain Launcher
#
# Builds the DNA, hApp, and web UI, then packages everything into a .webhapp
# file that can be installed in the Holochain Launcher.
#
# Usage:
#   nix develop github:holochain/holonix?ref=main-0.6 --command ./package.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

echo "📦 Building OurBlock for Holochain Launcher..."

# Build the DNA first
echo "🔨 Building DNA..."
./build.sh

# Build the UI
echo "🎨 Building UI..."
cd ui
npm run build
cd ..

# Package the webhapp
echo "📦 Packaging webhapp..."
hc web-app pack workdir -o workdir/our_block.webhapp

echo "✅ Successfully packaged OurBlock!"
echo ""
echo "📁 Output file: workdir/our_block.webhapp"
echo ""
echo "To install in Holochain Launcher:"
echo "  1. Open Holochain Launcher"
echo "  2. Click 'Install new app'"
echo "  3. Select workdir/our_block.webhapp"
