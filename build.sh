#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# OurBlock - Build Script
#
# Builds the Holochain zomes and packages the DNA and hApp
#
# Usage:
#   nix develop github:holochain/holonix?ref=main-0.6 --command ./build.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

echo "🔨 Building OurBlock zomes..."

# Critical: RUSTFLAGS required for getrandom 0.3 WASM compatibility
export RUSTFLAGS='--cfg getrandom_backend="custom"'

# Build all zomes
echo "   Compiling WASM zomes..."
cargo build --release --target wasm32-unknown-unknown

echo "✅ Zomes built successfully!"

# Package the DNA
echo "📦 Packaging DNA..."
hc dna pack dnas/our_block/workdir -o dnas/our_block/workdir/our_block.dna

# Package the hApp
echo "📦 Packaging hApp..."
hc app pack workdir -o workdir/our_block.happ

echo ""
echo "✅ Build complete!"
echo "   DNA: dnas/our_block/workdir/our_block.dna"
echo "   hApp: workdir/our_block.happ"
