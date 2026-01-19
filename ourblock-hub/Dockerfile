# Stage 1: Build UI
FROM node:20-slim AS ui-builder
WORKDIR /app/ui
COPY ui/package.json ui/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY ui/ ./
RUN pnpm build

# Stage 2: Get Holochain Binaries
# Use the same base image as the original deployment to ensure binary compatibility
FROM holochain/edge-node:v0.6 AS hc-bin

# Stage 3: Runtime
FROM ghcr.io/home-assistant/amd64-base-debian:bookworm

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    gettext-base \
    openssl \
    ca-certificates \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy Binaries
COPY --from=hc-bin /usr/bin/holochain /usr/bin/holochain
COPY --from=hc-bin /usr/bin/hc /usr/bin/hc
COPY --from=hc-bin /usr/bin/lair-keystore /usr/bin/lair-keystore

# Prepare Directories
COPY rootfs/ /

# Copy UI
COPY --from=ui-builder /app/ui/dist /www

# Copy App Data
COPY happ/our_block.happ /usr/local/share/our_block.happ
COPY templates/conductor-config.yaml /templates/conductor-config.yaml

# S6 Setup
RUN chmod +x /etc/services.d/*/run /etc/cont-init.d/*

CMD []
