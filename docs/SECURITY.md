# OurBlock Security Architecture

## Three-Layer Defense-in-Depth

OurBlock implements a comprehensive security model for its Docker update system with three independent security layers:

```
┌─────────────────────────────┐
│   Layer 3: HTTPS Proxy      │  ← Localhost-only binding
│   (nginx)                   │  ← HTTPS encryption
└─────────────┬───────────────┘  ← Real IP forwarding
              │
┌─────────────▼───────────────┐
│   Layer 2: API Gateway      │  ← API key authentication
│   (Rust Sidecar)            │  ← Rate limiting (1/5min)
└─────────────┬───────────────┘  ← Structured logging
              │
┌─────────────▼───────────────┐
│   Layer 1: Firewall         │  ← Restricted Docker API
│   (Socket Proxy)            │  ← ALLOW_RESTARTS=1 only
└─────────────┬───────────────┘  ← Read-only socket
              │
┌─────────────▼───────────────┐
│   Docker Engine             │
└─────────────────────────────┘
```

## Layer 1: Socket Proxy (Firewall)

**Purpose:** Restrict Docker API access to only essential operations.

**Implementation:** [linuxserver/socket-proxy](https://hub.docker.com/r/linuxserver/socket-proxy)

**Configuration:**
```yaml
socket-proxy:
  environment:
    - ALLOW_RESTARTS=1    # Only allow container restarts
    - CONTAINERS=0        # Disable everything else
    - IMAGES=0
    - POST=0
    - EXEC=0
```

**Security Benefits:**
- ✅ Prevents container removal (`docker rm`)
- ✅ Prevents shell access (`docker exec`)
- ✅ Prevents image manipulation (`docker rmi`)
- ✅ Prevents arbitrary commands (`POST /containers/create`)
- ✅ Read-only socket mount

**Attack Scenarios Prevented:**
- Malicious actor cannot delete containers
- Cannot exec into running containers
- Cannot modify images or networks
- Limited blast radius even if authenticated

## Layer 2: Rust Sidecar (API Gateway)

**Purpose:** Authentication, rate limiting, and request validation.

**Implementation:** [infra/sidecar](../infra/sidecar) - Rust + Axum + tower-governor

**Security Features:**

### Authentication
```rust
// Requires X-OurBlock-Admin-Key header
async fn auth_middleware(headers: HeaderMap) {
    let api_key = headers.get("X-OurBlock-Admin-Key");
    if api_key != Some(&state.admin_api_key) {
        return Err(StatusCode::UNAUTHORIZED);
    }
}
```

**Key Generation:**
```bash
# Generate 32-byte random key
openssl rand -base64 32
```

### Rate Limiting
```rust
// 1 request per 5 minutes per IP
GovernorConfigBuilder::default()
    .period(Duration::from_secs(300))
    .burst_size(1)
    .finish()?
```

**Prevents:**
- ✅ DDoS attacks on update endpoint
- ✅ Accidental rapid updates
- ✅ Automated abuse
- ✅ Update spam

### Structured Logging
```json
{
  "timestamp": "2026-01-17T12:00:00Z",
  "level": "INFO",
  "real_ip": "127.0.0.1",
  "proxy_ip": "172.29.0.2",
  "path": "/update",
  "message": "Authenticated request"
}
```

**Audit Trail:**
- Who requested updates (IP address)
- When requests occurred (timestamp)
- Which requests succeeded/failed (status)
- All unauthorized attempts logged

## Layer 3: Nginx Reverse Proxy (Network Isolation)

**Purpose:** Localhost-only binding + HTTPS encryption + IP forwarding.

**Implementation:** [infra/nginx](../infra/nginx) - Nginx + self-signed certs

**Security Features:**

### Localhost-Only Binding
```yaml
nginx:
  ports:
    - "127.0.0.1:4443:443"  # ONLY localhost
```

**What this prevents:**
- ❌ Access from other devices on Wi-Fi network
- ❌ Access from internet (even with port forwarding)
- ❌ Lateral movement in case of network compromise
- ✅ Only accessible from the host machine

**Test:**
```bash
# ✅ Works (localhost)
curl https://localhost:4443/health

# ❌ Fails (network IP)
curl https://192.168.1.100:4443/health
```

### HTTPS Encryption
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
```

**Benefits:**
- Encrypted admin API traffic (even on localhost)
- Protection against local eavesdropping
- Certificate validation (self-signed in dev, real in prod)

### Real IP Forwarding
```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

**Why this matters:**
- Rate limiting based on actual client IP (not proxy)
- Accurate audit logs
- Prevents IP spoofing

### Security Headers
```nginx
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

## Communication Flow

### Successful Update Request

```
1. Browser → https://127.0.0.1:4443/update
   Headers: X-OurBlock-Admin-Key: abc123...

2. Nginx (Layer 3) ✓
   - Validates localhost connection
   - Terminates HTTPS
   - Adds X-Real-IP: 127.0.0.1
   - Proxies to http://sidecar:3001/update

3. Sidecar (Layer 2) ✓
   - Checks API key (abc123... == ADMIN_API_KEY)
   - Checks rate limit (last request > 5 min ago)
   - Logs: [INFO] Update by 127.0.0.1 - Authorized
   - Sends Docker command to socket-proxy

4. Socket Proxy (Layer 1) ✓
   - Validates command is "restart" (ALLOW_RESTARTS=1)
   - Forwards to Docker socket
   - Logs: [INFO] Restart command allowed

5. Docker Engine ✓
   - Pulls latest images
   - Restarts containers
```

### Blocked Attack Scenarios

#### Scenario 1: Unauthorized Access (No API Key)
```
1. Attacker → https://localhost:4443/update
   Headers: (no X-OurBlock-Admin-Key)

2. Nginx (Layer 3) ✓
   - HTTPS validated
   - Forwards to sidecar

3. Sidecar (Layer 2) ✗ BLOCKED
   - API key missing
   - Returns 401 Unauthorized
   - Logs: [WARN] Unauthorized attempt from 127.0.0.1
```

#### Scenario 2: Rate Limit Exceeded
```
1. User → https://localhost:4443/update (2nd request in 1 minute)
   Headers: X-OurBlock-Admin-Key: abc123...

2. Nginx (Layer 3) ✓
   - HTTPS validated

3. Sidecar (Layer 2) ✗ BLOCKED
   - API key valid
   - Rate limit exceeded (last request 1 min ago, need 5 min)
   - Returns 429 Too Many Requests
   - Logs: [WARN] Rate limit exceeded for 127.0.0.1
```

#### Scenario 3: Network Attack (From Wi-Fi)
```
1. Attacker on Wi-Fi → https://192.168.1.100:4443/update
   (Host IP on local network)

✗ BLOCKED at TCP level
   - Port 4443 bound to 127.0.0.1 only
   - Connection refused
   - Never reaches nginx
```

#### Scenario 4: Malicious Command (Container Deletion)
```
1. Compromised client → https://localhost:4443/delete-container
   Headers: X-OurBlock-Admin-Key: abc123...

2. Nginx (Layer 3) ✓
   - HTTPS validated

3. Sidecar (Layer 2) ✗ BLOCKED
   - Endpoint not implemented (404 Not Found)
   - Even if implemented and auth passed...

4. Socket Proxy (Layer 1) ✗ BLOCKED
   - ALLOW_RESTARTS=1 only
   - "delete" command not allowed
   - Returns 403 Forbidden
```

## File Structure

```
/ourblock
├── infra/
│   ├── sidecar/              # Layer 2: Rust API gateway
│   │   ├── src/main.rs       # Auth + rate limiting
│   │   ├── Cargo.toml        # Dependencies
│   │   ├── Dockerfile        # Container image
│   │   └── README.md         # Documentation
│   │
│   └── nginx/                # Layer 3: HTTPS proxy
│       ├── sidecar.conf      # Nginx config
│       ├── Dockerfile        # Container image
│       ├── generate-certs.sh # SSL cert generator
│       └── README.md         # Documentation
│
├── deploy/
│   ├── docker-compose.yaml   # All layers orchestration
│   ├── .env.example          # Environment template
│   └── .env                  # Secrets (gitignored)
│
└── docs/
    └── SECURITY.md           # This file
```

## Security Checklist

### Development

- [ ] Generate self-signed certificates: `cd infra/nginx && bash generate-certs.sh`
- [ ] Set ADMIN_API_KEY in `deploy/.env`: `openssl rand -base64 32`
- [ ] Set VITE_ADMIN_API_KEY in `ui/.env.local` to match
- [ ] Verify localhost binding: `docker compose port nginx 443` → `127.0.0.1:4443`
- [ ] Test unauthorized access is blocked
- [ ] Test rate limiting works (2 requests in < 5 min)

### Production

- [ ] **CRITICAL:** Change ADMIN_API_KEY to strong random value
- [ ] Use real SSL certificates (Let's Encrypt or commercial CA)
- [ ] Enable structured log aggregation (ELK, Splunk, etc.)
- [ ] Monitor for unauthorized access attempts
- [ ] Regularly update Rust dependencies: `cargo update`
- [ ] Regularly update Docker images: `docker compose pull`
- [ ] Set up alerting for failed auth attempts
- [ ] Document API key rotation procedure
- [ ] Restrict Docker socket permissions: `chmod 660 /var/run/docker.sock`

## Threat Model

### In Scope

✅ **Network-based attacks:** Localhost binding prevents access from other devices

✅ **Unauthorized API access:** API key authentication required

✅ **Rate limiting bypass:** Per-IP rate limiting enforced

✅ **Docker privilege escalation:** Socket proxy restricts available commands

✅ **Audit trail:** All requests logged with IP and timestamp

### Out of Scope

⚠️ **Physical access:** Attacker with shell access can read .env file

⚠️ **Browser compromise:** XSS could steal API key from localStorage

⚠️ **Social engineering:** User could be tricked into sharing API key

⚠️ **Container escape:** Docker itself could have vulnerabilities

### Mitigations

1. **Encrypt .env file at rest** (future enhancement)
2. **Store API key in secure credential store** (e.g., HashiCorp Vault)
3. **Implement API key rotation** (e.g., every 90 days)
4. **Add 2FA for sensitive operations** (future enhancement)
5. **Keep Docker updated** to patch vulnerabilities

## Testing

### Test Authentication

```bash
# Should fail (no API key)
curl -X POST https://localhost:4443/update --insecure

# Should succeed
curl -X POST https://localhost:4443/update \
  -H "X-OurBlock-Admin-Key: your-key" \
  --insecure
```

### Test Rate Limiting

```bash
# First request - should succeed
curl -X POST https://localhost:4443/update \
  -H "X-OurBlock-Admin-Key: your-key" \
  --insecure

# Second request (< 5 min) - should fail with 429
curl -X POST https://localhost:4443/update \
  -H "X-OurBlock-Admin-Key: your-key" \
  --insecure
```

### Test Localhost Binding

```bash
# Get your local IP
ipconfig  # Windows
ifconfig  # Linux/Mac

# Try accessing from network IP (should fail)
curl https://192.168.x.x:4443/health --insecure
# Connection refused

# Try from localhost (should work)
curl https://localhost:4443/health --insecure
# {"status":"ok"}
```

### Test Socket Proxy Restrictions

```bash
# This should work (restart allowed)
docker exec ourblock-sidecar \
  docker compose restart

# This should fail (rm not allowed)
docker exec ourblock-sidecar \
  docker rm ourblock-conductor
```

## Monitoring

### Key Metrics

- **Failed auth attempts:** Spike indicates attack
- **Rate limit violations:** User confusion or abuse
- **Update frequency:** Unusual patterns
- **Response times:** Degradation may indicate DDoS

### Log Queries

```bash
# View all unauthorized attempts (last 24h)
docker compose logs sidecar --since 24h | grep "Unauthorized"

# Count rate limit violations
docker compose logs sidecar --since 24h | grep "Rate limit" | wc -l

# Show all successful updates
docker compose logs sidecar --since 7d | grep "Update requested"
```

### Alerting Rules

1. **Alert:** > 10 failed auth attempts in 1 hour
2. **Alert:** > 5 rate limit violations from same IP in 1 day
3. **Alert:** Update request from non-127.0.0.1 IP (should be impossible)
4. **Alert:** Socket proxy receives non-restart command

## Further Reading

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Nginx Security Controls](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size)
- [Rust Security Guidelines](https://anssi-fr.github.io/rust-guide/)

## Contact

For security issues, please email: security@ourblock.local (update with real contact)

---

**Last Updated:** January 17, 2026  
**Version:** 1.0.0  
**Reviewed By:** Security Team
