# OurBlock Hardened Sidecar

Secure Rust-based sidecar service for managing Docker container updates with enterprise-grade security.

## Security Features

### 🔒 Multi-Layer Security

1. **Socket Proxy Firewall**
   - Docker socket access filtered through `socket-proxy`
   - Only `ALLOW_RESTARTS=1` enabled
   - All other Docker API endpoints blocked
   - Read-only socket mount

2. **API Key Authentication**
   - Required `X-OurBlock-Admin-Key` header
   - Configurable via `ADMIN_API_KEY` environment variable
   - Automatic rejection of unauthorized requests
   - Structured audit logging

3. **Rate Limiting**
   - 1 update request per 5 minutes per IP address
   - Prevents abuse and accidental rapid updates
   - Configurable burst size and period
   - Uses `tower-governor` for distributed rate limiting

4. **Network Isolation**
   - Runs on internal `secure-admin-net` network
   - No direct internet access
   - Communicates only with socket-proxy
   - Minimized attack surface

5. **Structured Logging**
   - JSON-formatted logs via `tracing`
   - Records: timestamp, IP, endpoint, outcome
   - Audit trail for all update attempts
   - Integration-ready for log aggregation

## Building

```bash
# Development build
cargo build

# Production build (optimized)
cargo build --release

# Docker build
docker build -t ourblock/sidecar:latest .
```

## Running

### Standalone
```bash
# Set environment variables
export ADMIN_API_KEY="your-secure-key-here"
export DOCKER_COMPOSE_FILE="/path/to/docker-compose.yaml"

# Run
cargo run --release
```

### Docker Compose
```bash
# From deploy directory
docker compose up -d sidecar

# View logs
docker compose logs -f sidecar
```

## API Endpoints

### `GET /health`
Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-17T12:00:00Z"
}
```

### `GET /version`
Get current and latest version (auth required).

**Headers:**
```
X-OurBlock-Admin-Key: your-api-key
```

**Response:**
```json
{
  "version": "0.1.0",
  "latest": "0.1.1",
  "update_available": true
}
```

### `POST /update`
Trigger Docker Compose update (auth required, rate limited).

**Headers:**
```
X-OurBlock-Admin-Key: your-api-key
Content-Type: application/json
```

**Request:**
```json
{
  "version": "0.1.1"
}
```

**Response:**
```json
{
  "status": "updating",
  "message": "Update process started"
}
```

**Rate Limit:** 1 request per 5 minutes per IP

### `POST /restart`
Restart Docker containers (auth required, rate limited).

**Headers:**
```
X-OurBlock-Admin-Key: your-api-key
```

**Response:**
```json
{
  "status": "restarting",
  "message": "Restart process started"
}
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_API_KEY` | `change-me-in-production` | API key for authentication |
| `DOCKER_COMPOSE_FILE` | `/app/docker-compose.yaml` | Path to docker-compose file |
| `PORT` | `3001` | HTTP server port |
| `APP_VERSION` | `0.1.0` | Current app version |
| `RUST_LOG` | `info` | Log level (error, warn, info, debug, trace) |
| `DOCKER_HOST` | `tcp://socket-proxy:2375` | Docker socket proxy URL |

## Security Best Practices

### Production Deployment

1. **Strong API Key**
   ```bash
   # Generate secure random key
   openssl rand -base64 32
   ```

2. **Restrict Network Access**
   - Keep `secure-admin-net` internal
   - No exposed ports to host
   - Use reverse proxy if external access needed

3. **Monitor Logs**
   ```bash
   # View structured JSON logs
   docker compose logs -f sidecar | jq
   ```

4. **Regular Updates**
   - Keep Rust dependencies updated
   - Rebuild container images regularly
   - Monitor security advisories

### Log Monitoring

All operations are logged in structured JSON format:

```json
{
  "timestamp": "2026-01-17T12:00:00Z",
  "level": "INFO",
  "target": "ourblock_sidecar",
  "fields": {
    "ip": "172.28.0.5",
    "path": "/update",
    "message": "Authenticated request"
  }
}
```

Monitor for:
- Unauthorized access attempts (`level: "WARN"`)
- Failed updates (`level: "ERROR"`)
- Unusual request patterns
- Rate limit violations

## Testing

```bash
# Health check
curl http://localhost:3001/health

# Version check (with auth)
curl -H "X-OurBlock-Admin-Key: your-key" \
     http://localhost:3001/version

# Trigger update (with auth)
curl -X POST \
     -H "X-OurBlock-Admin-Key: your-key" \
     -H "Content-Type: application/json" \
     -d '{"version": "0.1.1"}' \
     http://localhost:3001/update

# Test rate limiting (should fail on 2nd request within 5 minutes)
curl -X POST \
     -H "X-OurBlock-Admin-Key: your-key" \
     http://localhost:3001/update
```

## Troubleshooting

### "Invalid or missing API key"
- Ensure `X-OurBlock-Admin-Key` header is set
- Check `ADMIN_API_KEY` environment variable matches

### "Rate limit exceeded"
- Wait 5 minutes between update requests
- Check logs for request timestamps

### "Docker command failed"
- Verify socket-proxy is running
- Check `DOCKER_HOST` environment variable
- Ensure socket-proxy allows restarts

### "Connection refused"
- Verify sidecar is on `secure-admin-net`
- Check network configuration
- Ensure socket-proxy is accessible

## Architecture

```
┌─────────────────┐
│   UI (Browser)  │
└────────┬────────┘
         │ POST /update
         │ X-OurBlock-Admin-Key: xxx
         ▼
┌─────────────────────────────┐
│   Hardened Sidecar (Rust)   │
│  - Auth middleware          │
│  - Rate limiter (5min/req)  │
│  - Structured logging       │
└──────────┬──────────────────┘
           │ Internal network
           │ (secure-admin-net)
           ▼
┌──────────────────────────────┐
│   Socket Proxy (Firewall)    │
│  - Read-only socket mount    │
│  - ALLOW_RESTARTS=1 only     │
│  - All other endpoints=0     │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   Docker Socket              │
│  /var/run/docker.sock        │
└──────────────────────────────┘
```

## License

MIT
