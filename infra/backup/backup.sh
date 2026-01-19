#!/bin/bash
#
# OurBlock Automated Backup Script
#
# This script performs encrypted backups of:
# - Holochain conductor storage directory
# - Lair keystore (encrypted credentials)
# - Configuration files
#
# Encryption: AES-256-CBC using ADMIN_API_KEY as passphrase
# Schedule: Daily at 3 AM via cron
# Retention: 30 days of backups

set -e  # Exit on error

# ============================================================================
# Configuration
# ============================================================================

BACKUP_DIR="/backups"
STORAGE_DIR="/storage"
LAIR_DIR="/lair"
CONFIG_DIR="/config"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="ourblock_backup_${TIMESTAMP}"
TEMP_DIR="/tmp/${BACKUP_NAME}"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Logging
# ============================================================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

log "Starting OurBlock backup process..."

# Check if ADMIN_API_KEY is set (required for encryption)
if [ -z "$ADMIN_API_KEY" ]; then
    error "ADMIN_API_KEY environment variable not set. Cannot encrypt backup."
    exit 1
fi

# Check if required directories exist
if [ ! -d "$STORAGE_DIR" ]; then
    error "Storage directory not found: $STORAGE_DIR"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$TEMP_DIR"

# ============================================================================
# Graceful Conductor Shutdown
# ============================================================================

log "Preparing conductor for backup..."

# Signal conductor to flush data and prepare for backup
# We use Docker API to send SIGUSR1 (graceful save signal)
if command -v docker &> /dev/null; then
    CONDUCTOR_CONTAINER=$(docker ps --filter "name=conductor" --format "{{.Names}}" | head -n 1)
    
    if [ -n "$CONDUCTOR_CONTAINER" ]; then
        log "Found conductor container: $CONDUCTOR_CONTAINER"
        log "Sending graceful shutdown signal..."
        
        # Send SIGUSR1 to trigger graceful data flush
        docker kill --signal=SIGUSR1 "$CONDUCTOR_CONTAINER" 2>/dev/null || true
        
        # Wait for conductor to flush data (5 seconds)
        sleep 5
        
        # Optionally pause container during backup
        # docker pause "$CONDUCTOR_CONTAINER"
    else
        warn "Conductor container not found. Proceeding with backup anyway."
    fi
fi

# ============================================================================
# Create Backup Archive
# ============================================================================

log "Creating backup archive..."

# Copy storage directory
if [ -d "$STORAGE_DIR" ]; then
    log "Backing up storage directory..."
    mkdir -p "$TEMP_DIR/storage"
    cp -r "$STORAGE_DIR"/* "$TEMP_DIR/storage/" 2>/dev/null || warn "No storage files found"
fi

# Copy lair keystore
if [ -d "$LAIR_DIR" ]; then
    log "Backing up Lair keystore..."
    mkdir -p "$TEMP_DIR/lair"
    cp -r "$LAIR_DIR"/* "$TEMP_DIR/lair/" 2>/dev/null || warn "No lair files found"
fi

# Copy configuration files
if [ -d "$CONFIG_DIR" ]; then
    log "Backing up configuration..."
    mkdir -p "$TEMP_DIR/config"
    cp -r "$CONFIG_DIR"/* "$TEMP_DIR/config/" 2>/dev/null || warn "No config files found"
fi

# Create metadata file
cat > "$TEMP_DIR/backup_metadata.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "version": "v0.5.0",
  "backup_name": "$BACKUP_NAME",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "conductor_version": "$(docker exec ${CONDUCTOR_CONTAINER} holochain --version 2>/dev/null || echo 'unknown')"
}
EOF

# Create tarball
log "Compressing backup..."
TARBALL="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
tar -czf "$TARBALL" -C /tmp "$BACKUP_NAME"

# Verify tarball was created
if [ ! -f "$TARBALL" ]; then
    error "Failed to create tarball"
    exit 1
fi

TARBALL_SIZE=$(du -h "$TARBALL" | cut -f1)
log "Tarball created: ${TARBALL_SIZE}"

# ============================================================================
# Encrypt Backup
# ============================================================================

log "Encrypting backup with AES-256..."

# Use openssl to encrypt with AES-256-CBC
# Password is derived from ADMIN_API_KEY using PBKDF2
ENCRYPTED_FILE="${TARBALL}.enc"

openssl enc -aes-256-cbc \
    -salt \
    -pbkdf2 \
    -iter 100000 \
    -in "$TARBALL" \
    -out "$ENCRYPTED_FILE" \
    -pass "pass:${ADMIN_API_KEY}"

if [ ! -f "$ENCRYPTED_FILE" ]; then
    error "Failed to encrypt backup"
    exit 1
fi

ENCRYPTED_SIZE=$(du -h "$ENCRYPTED_FILE" | cut -f1)
log "Encrypted backup created: ${ENCRYPTED_SIZE}"

# Remove unencrypted tarball for security
rm -f "$TARBALL"

# Create symlink to latest backup
ln -sf "$ENCRYPTED_FILE" "${BACKUP_DIR}/latest-backup.tar.gz.enc"

# ============================================================================
# Resume Conductor
# ============================================================================

if [ -n "$CONDUCTOR_CONTAINER" ]; then
    log "Resuming conductor..."
    # docker unpause "$CONDUCTOR_CONTAINER" 2>/dev/null || true
    docker kill --signal=SIGUSR2 "$CONDUCTOR_CONTAINER" 2>/dev/null || true
fi

# ============================================================================
# Cleanup
# ============================================================================

log "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

# Remove backups older than retention period
log "Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "ourblock_backup_*.tar.gz.enc" -mtime "+${RETENTION_DAYS}" -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "ourblock_backup_*.tar.gz.enc" | wc -l)
log "Total backups retained: ${BACKUP_COUNT}"

# ============================================================================
# Summary
# ============================================================================

log "═══════════════════════════════════════════════════════════"
log "Backup completed successfully!"
log "Backup file: ${ENCRYPTED_FILE}"
log "Size: ${ENCRYPTED_SIZE}"
log "Encryption: AES-256-CBC with PBKDF2 (100k iterations)"
log "═══════════════════════════════════════════════════════════"

# Create status file for health check
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${BACKUP_DIR}/.last_backup"

exit 0
