# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock Edge Node Dockerfile
# Multi-arch build for Raspberry Pi (arm64) and Mini PC/Proxmox (amd64)
# ═══════════════════════════════════════════════════════════════════════════════

# Build stage for UI
FROM node:20-alpine AS ui-builder

WORKDIR /app/ui

# Copy UI source
COPY ui/package.json ui/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY ui/ ./
RUN pnpm build

# ═══════════════════════════════════════════════════════════════════════════════
# Main Edge Node Image
# ═══════════════════════════════════════════════════════════════════════════════
FROM holochain/edge-node:v0.6

LABEL org.opencontainers.image.title="OurBlock Edge Node"
LABEL org.opencontainers.image.description="Decentralized neighborhood community app on Holochain"
LABEL org.opencontainers.image.vendor="OurBlock Community"
LABEL org.opencontainers.image.source="https://github.com/ourblock/ourblock"
LABEL maintainer="OurBlock Contributors"

# Environment variables for Holochain configuration
ENV RUST_LOG=info
ENV HOLOCHAIN_NETWORK_TYPE=quic
ENV HOLOCHAIN_ADMIN_PORT=8001
ENV HOLOCHAIN_APP_PORT=8888
ENV LAIR_KEYSTORE_URL=lair://lair-keystore:50000

# Data directories
ENV DATA_DIR=/data
ENV CONDUCTOR_CONFIG_DIR=/config
ENV HAPP_DIR=/happs

# Create necessary directories
RUN mkdir -p ${DATA_DIR} ${CONDUCTOR_CONFIG_DIR} ${HAPP_DIR}

# Copy the hApp bundle
COPY workdir/our_block.happ ${HAPP_DIR}/our_block.happ

# Copy conductor configuration
COPY deploy/config/conductor-config.yaml ${CONDUCTOR_CONFIG_DIR}/conductor-config.yaml

# Copy UI build (for optional local serving)
COPY --from=ui-builder /app/ui/dist /ui

# Copy entrypoint script
COPY deploy/scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
# Admin interface
EXPOSE 8001
# App WebSocket interface  
EXPOSE 8888
# UI (if serving locally)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

# Volumes for persistent data
VOLUME ["/data", "/config"]

ENTRYPOINT ["/entrypoint.sh"]
CMD ["holochain", "-c", "/config/conductor-config.yaml"]
