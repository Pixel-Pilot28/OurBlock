#!/bin/bash
# =============================================================================
# OurBlock Stop Script
# Stops all services gracefully
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🛑 Stopping OurBlock..."
echo ""

echo "🔧 Stopping services..."
docker compose down

echo ""
echo "✅ OurBlock stopped successfully!"
echo ""
echo "📊 To view stopped containers: docker compose ps -a"
echo "🗑️  To remove volumes:         docker compose down -v"
echo "🚀 To start again:             ./start.sh"
echo ""
