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
  git \
  bash \
  jq

# Set working directory
WORKDIR /app

# Fetch repo assets needed for compose + infra
RUN git clone --depth 1 https://github.com/Pixel-Pilot28/OurBlock /tmp/ourblock \
  && cp /tmp/ourblock/deploy/docker-compose.yaml /app/docker-compose.yaml \
  && cp /tmp/ourblock/deploy/.env.example /app/.env.example \
  && cp -r /tmp/ourblock/infra /app/infra \
  && rm -rf /tmp/ourblock

# Copy Home Assistant integration scripts
COPY run.sh /app/run.sh
COPY discover.sh /app/discover.sh

# Make scripts executable
RUN chmod +x /app/run.sh /app/discover.sh

# Expose ports (when using host network mode, these are informational)
EXPOSE 4443 8888

# Health check (check if docker compose is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD docker compose ps 2>/dev/null | grep -q "Up" || exit 1

# Run the startup script (s6-overlay will handle this)
CMD ["/app/run.sh"]
