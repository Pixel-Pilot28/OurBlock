# Stage 1: Build UI
FROM node:20-slim AS ui-builder
WORKDIR /app/ui
COPY ui/package.json ui/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY ui/ ./
RUN pnpm build

# Stage 2: Build Holochain Binaries
# Building from source as official images for 0.3.2 are unavailable
FROM rust:1.77-slim-bookworm AS hc-builder
WORKDIR /build
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install holochain --version 0.3.2
RUN cargo install lair_keystore --version 0.4.5
RUN cargo install holochain_cli --version 0.3.2 --bin hc

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
COPY --from=hc-builder /usr/local/cargo/bin/holochain /usr/bin/holochain
COPY --from=hc-builder /usr/local/cargo/bin/hc /usr/bin/hc
COPY --from=hc-builder /usr/local/cargo/bin/lair-keystore /usr/bin/lair-keystore

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
