# OurBlock Home Assistant Add-on
# Single-container deployment using S6-overlay for process management

ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM $BUILD_FROM

# Build arguments
ARG BUILD_VERSION
ARG HOLOCHAIN_VERSION=0.4.0
ARG LAIR_VERSION=0.5.2

# Install system dependencies
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    openssl \
    cargo \
    rust \
    avahi-dev \
    avahi-tools \
    dbus \
    nginx \
    git

# Install Holochain binary
RUN curl -L https://github.com/holochain/holochain/releases/download/holochain-${HOLOCHAIN_VERSION}/holochain-v${HOLOCHAIN_VERSION}-x86_64-unknown-linux-musl.tar.gz -o /tmp/holochain.tar.gz \
    && tar -xzf /tmp/holochain.tar.gz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/holochain \
    && rm /tmp/holochain.tar.gz

# Install Lair Keystore binary
RUN curl -L https://github.com/holochain/lair/releases/download/lair_keystore-v${LAIR_VERSION}/lair-keystore-v${LAIR_VERSION}-x86_64-unknown-linux-musl.tar.gz -o /tmp/lair.tar.gz \
    && tar -xzf /tmp/lair.tar.gz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/lair-keystore \
    && rm /tmp/lair.tar.gz

# Clone repository for UI and DNAs
WORKDIR /app
RUN git clone --depth 1 https://github.com/Pixel-Pilot28/OurBlock /app/ourblock

# Build Rust sidecar
WORKDIR /app/ourblock/infra/sidecar
RUN cargo build --release \
    && cp target/release/ourblock-sidecar /usr/local/bin/ \
    && chmod +x /usr/local/bin/ourblock-sidecar

# Copy UI assets
RUN mkdir -p /app/ui \
    && cp -r /app/ourblock/ui/dist/* /app/ui/ 2>/dev/null || echo "UI build artifacts not found, skipping"

# Copy DNA files
RUN mkdir -p /app/dnas \
    && cp /app/ourblock/dnas/*.dna /app/dnas/ 2>/dev/null || echo "DNA files not found, skipping"

# Configure Nginx
COPY rootfs/etc/nginx/nginx.conf /etc/nginx/nginx.conf

# Copy S6 service definitions
COPY rootfs/ /

# Set working directory
WORKDIR /config

# Expose ports
EXPOSE 4443 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f https://localhost:4443/health || exit 1

# S6 will start services
ENTRYPOINT ["/init"]
