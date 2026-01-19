# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock Sidecar Maintenance Service - Dockerfile
# 
# Lightweight Node.js service for managing Docker container updates
# Runs alongside the main app with access to Docker socket
# ═══════════════════════════════════════════════════════════════════════════════

FROM node:20-alpine

LABEL maintainer="OurBlock Team"
LABEL description="Sidecar service for managing OurBlock container updates"
LABEL version="0.1.0"

# Install Docker CLI for container management
RUN apk add --no-cache docker-cli wget

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (none needed for vanilla implementation)
# RUN npm install --production

# Copy server code
COPY server.js ./

# Expose sidecar port
EXPOSE 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1

# Run as non-root user for security
USER node

# Start the sidecar service
CMD ["node", "server.js"]
