# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock Hardened Sidecar - Multi-stage Dockerfile
# 
# Secure Rust-based service for managing Docker container updates
# Features: API key auth, rate limiting, structured logging
# ═══════════════════════════════════════════════════════════════════════════════

# Build stage
FROM rust:1.75-alpine AS builder

LABEL maintainer="OurBlock Team"
LABEL description="Hardened sidecar service with authentication and rate limiting"

# Install build dependencies
RUN apk add --no-cache musl-dev openssl-dev

WORKDIR /build

# Copy manifests (Cargo.lock will be auto-generated if missing)
COPY Cargo.toml ./

# Create a dummy main.rs to cache dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY src ./src

# Build the application (dependencies are cached)
RUN touch src/main.rs && \
    cargo build --release

# ═══════════════════════════════════════════════════════════════════════════════
# Runtime stage
# ═══════════════════════════════════════════════════════════════════════════════

FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    docker-cli \
    docker-cli-compose \
    ca-certificates \
    tini

# Create non-root user
RUN addgroup -g 1001 sidecar && \
    adduser -D -u 1001 -G sidecar sidecar

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/target/release/ourblock-sidecar /app/ourblock-sidecar

# Set ownership
RUN chown -R sidecar:sidecar /app

# Switch to non-root user
USER sidecar

# Expose sidecar port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the sidecar service
CMD ["/app/ourblock-sidecar"]
