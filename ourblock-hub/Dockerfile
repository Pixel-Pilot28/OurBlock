# OurBlock Hub - Home Assistant Add-on Dockerfile
ARG BUILD_FROM
FROM $BUILD_FROM

# Install system dependencies
RUN apk add --no-cache \
    docker-cli \
    docker-cli-compose \
    avahi-dev \
    avahi-tools \
    dbus \
    nginx \
    openssl \
  tini \
  git

# Set working directory
WORKDIR /app

# Fetch repo assets needed for compose + infra
RUN git clone --depth 1 https://github.com/Pixel-Pilot28/OurBlock /tmp/ourblock \
  && cp /tmp/ourblock/deploy/docker-compose.yaml /app/docker-compose.yaml \
  && cp /tmp/ourblock/deploy/.env.example /app/.env.example \
  && cp -r /tmp/ourblock/infra /app/infra \
  && rm -rf /tmp/ourblock

# Copy Home Assistant integration scripts
COPY ourblock-hub/run.sh /app/run.sh
COPY ourblock-hub/discover.sh /app/discover.sh

# Make scripts executable
RUN chmod +x /app/run.sh /app/discover.sh

# Expose ports (defined in config.yaml)
EXPOSE 443 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider https://localhost:443/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Run the startup script
CMD ["/app/run.sh"]
