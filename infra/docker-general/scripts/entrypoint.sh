#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock Edge Node Entrypoint Script
# ═══════════════════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  OurBlock Edge Node - Starting..."
echo "═══════════════════════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────────
# Environment Setup
# ─────────────────────────────────────────────────────────────────────────────────

DATA_DIR="${DATA_DIR:-/data}"
CONDUCTOR_CONFIG_DIR="${CONDUCTOR_CONFIG_DIR:-/config}"
HAPP_DIR="${HAPP_DIR:-/happs}"
HAPP_FILE="${HAPP_DIR}/our_block.happ"

# Ensure directories exist
mkdir -p "${DATA_DIR}" "${CONDUCTOR_CONFIG_DIR}"

# ─────────────────────────────────────────────────────────────────────────────────
# Wait for Lair Keystore
# ─────────────────────────────────────────────────────────────────────────────────

if [ -n "${LAIR_KEYSTORE_URL}" ]; then
    echo "→ Waiting for Lair Keystore..."
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if nc -z lair-keystore 50000 2>/dev/null; then
            echo "  ✓ Lair Keystore is available"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "  Waiting for Lair Keystore... (attempt $RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "  ✗ Failed to connect to Lair Keystore"
        exit 1
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────────
# Substitute Environment Variables in Config
# ─────────────────────────────────────────────────────────────────────────────────

echo "→ Configuring conductor..."

# Set defaults for environment variables
export BOOTSTRAP_URL="${BOOTSTRAP_URL:-https://bootstrap.holo.host}"
export SIGNAL_URL="${SIGNAL_URL:-wss://signal.holo.host}"
export LAIR_KEYSTORE_URL="${LAIR_KEYSTORE_URL:-lair://localhost:50000}"

# Substitute environment variables in config file
envsubst < "${CONDUCTOR_CONFIG_DIR}/conductor-config.yaml" > "${CONDUCTOR_CONFIG_DIR}/conductor-config-resolved.yaml"

echo "  ✓ Configuration ready"

# ─────────────────────────────────────────────────────────────────────────────────
# Install hApp if not already installed
# ─────────────────────────────────────────────────────────────────────────────────

if [ -f "${HAPP_FILE}" ]; then
    echo "→ Checking hApp installation..."
    
    # Check if app is already installed (by looking for installed_apps marker)
    INSTALLED_MARKER="${DATA_DIR}/.ourblock_installed"
    
    if [ ! -f "${INSTALLED_MARKER}" ]; then
        echo "  Installing OurBlock hApp..."
        
        # Start conductor temporarily to install the app
        holochain -c "${CONDUCTOR_CONFIG_DIR}/conductor-config-resolved.yaml" &
        CONDUCTOR_PID=$!
        
        # Wait for conductor to be ready
        sleep 10
        
        # Install the hApp using hc CLI
        if hc app install "${HAPP_FILE}" --agent-key-id default --app-id ourblock; then
            touch "${INSTALLED_MARKER}"
            echo "  ✓ OurBlock hApp installed successfully"
        else
            echo "  ✗ Failed to install hApp"
        fi
        
        # Stop temporary conductor
        kill $CONDUCTOR_PID 2>/dev/null || true
        wait $CONDUCTOR_PID 2>/dev/null || true
        
        sleep 2
    else
        echo "  ✓ OurBlock hApp already installed"
    fi
else
    echo "  ⚠ No hApp file found at ${HAPP_FILE}"
fi

# ─────────────────────────────────────────────────────────────────────────────────
# Start the Conductor
# ─────────────────────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  OurBlock Edge Node - Running"
echo "  Admin Port: ${HOLOCHAIN_ADMIN_PORT:-8001}"
echo "  App Port:   ${HOLOCHAIN_APP_PORT:-8888}"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Execute the main command (holochain conductor)
exec "$@" -c "${CONDUCTOR_CONFIG_DIR}/conductor-config-resolved.yaml"
