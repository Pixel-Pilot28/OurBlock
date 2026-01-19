#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock Edge Node - Multi-Architecture Build Script
# 
# Builds Docker images for:
#   - linux/amd64 (Mini PCs, Proxmox, x86 servers)
#   - linux/arm64 (Raspberry Pi 4/5, ARM-based devices)
# 
# Prerequisites:
#   - Docker with buildx plugin
#   - Docker Hub account (or other registry) for pushing
# 
# Usage:
#   ./build-multiarch.sh              # Build locally
#   ./build-multiarch.sh --push       # Build and push to registry
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
IMAGE_NAME="${IMAGE_NAME:-ourblock/edge-node}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORMS="linux/amd64,linux/arm64"
BUILDER_NAME="ourblock-multiarch-builder"

# Parse arguments
PUSH_FLAG=""
if [ "$1" = "--push" ]; then
    PUSH_FLAG="--push"
    echo "→ Will push to registry after build"
fi

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  OurBlock Multi-Architecture Build"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Image:     ${IMAGE_NAME}:${IMAGE_TAG}"
echo "  Platforms: ${PLATFORMS}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────────
# Setup buildx builder
# ─────────────────────────────────────────────────────────────────────────────────

echo "→ Setting up buildx builder..."

# Create builder if it doesn't exist
if ! docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
    docker buildx create --name "${BUILDER_NAME}" --driver docker-container --bootstrap
fi

docker buildx use "${BUILDER_NAME}"
echo "  ✓ Builder ready"

# ─────────────────────────────────────────────────────────────────────────────────
# Build the image
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo "→ Building multi-architecture image..."
echo ""

cd "$(dirname "$0")/.."

docker buildx build \
    --platform "${PLATFORMS}" \
    --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
    --file deploy/Dockerfile \
    ${PUSH_FLAG} \
    --progress=plain \
    .

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  ✓ Build complete!"
echo "═══════════════════════════════════════════════════════════════════════════════"

if [ -z "${PUSH_FLAG}" ]; then
    echo ""
    echo "  To push to registry, run: ./build-multiarch.sh --push"
fi
