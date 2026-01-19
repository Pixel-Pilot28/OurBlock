# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock - Home Assistant Add-on Dockerfile
# ═══════════════════════════════════════════════════════════════════════════════

ARG BUILD_FROM=ghcr.io/hassio-addons/base:15.0.0
FROM ${BUILD_FROM}

# Labels
LABEL \
    io.hass.name="OurBlock" \
    io.hass.description="Decentralized neighborhood community platform" \
    io.hass.arch="amd64|aarch64|armv7" \
    io.hass.type="addon" \
    io.hass.version="1.0.0" \
    maintainer="OurBlock Community"

# Install dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-flask \
    nginx \
    supervisor \
    curl

# Copy rootfs
COPY rootfs /

# Copy UI files
COPY ui/dist /var/www/html

# Set permissions
RUN chmod a+x /etc/services.d/*/run \
    && chmod a+x /etc/services.d/*/finish \
    && chmod a+x /etc/cont-init.d/*

# Expose ports
EXPOSE 3000 8080 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:3000/health || exit 1
