#!/bin/bash
# =============================================================================
# OurBlock Start Script
# Starts all services in the correct order
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting OurBlock..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  WARNING: Update ADMIN_API_KEY in .env before production use!"
    echo ""
fi

# Build images if needed
echo "📦 Building Docker images..."
docker compose build

echo ""
echo "🔧 Starting infrastructure services..."
docker compose up -d socket-proxy

echo "⏳ Waiting for socket-proxy to be ready..."
sleep 3

echo ""
echo "🔧 Starting sidecar service..."
docker compose up -d sidecar

echo "⏳ Waiting for sidecar to be ready..."
sleep 2

echo ""
echo "🔧 Starting HTTPS proxy..."
docker compose up -d nginx

echo "⏳ Waiting for nginx to be ready..."
sleep 2

echo ""
echo "🔧 Starting Holochain services..."
docker compose up -d lair conductor

echo "⏳ Waiting for conductor to be ready..."
sleep 5

echo ""
echo "🔧 Starting UI..."
docker compose up -d ui

echo ""
echo "✅ OurBlock is starting up!"
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "🌐 Access Points:"
echo "  - Main App:    http://localhost:5173"
echo "  - Admin API:   https://localhost:4443 (localhost only)"
echo "  - Conductor:   ws://localhost:8888"
echo ""
echo "📝 Logs:"
echo "  - View all:    docker compose logs -f"
echo "  - View UI:     docker compose logs -f ui"
echo "  - View sidecar: docker compose logs -f sidecar"
echo ""
echo "🛑 To stop:     ./stop.sh"
echo ""
