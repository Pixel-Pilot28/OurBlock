# OurBlock HTTPS Reverse Proxy

Nginx-based HTTPS reverse proxy that provides secure, localhost-only access to the sidecar update API.

## Security Features

### 🔒 Localhost-Only Binding

The nginx proxy is configured to bind **only to 127.0.0.1**, making it invisible to other devices on your Wi-Fi network:

```yaml
ports:
  - "127.0.0.1:4443:443"  # HTTPS (localhost only)
  - "127.0.0.1:8080:80"   # HTTP redirect (localhost only)
```

**What this means:**
- ✅ Accessible from `https://localhost:4443` on your machine
- ✅ Accessible from `https://127.0.0.1:4443` on your machine
- ❌ **NOT** accessible from `https://192.168.x.x:4443` (your local IP)
- ❌ **NOT** accessible from other devices on your network
- ❌ **NOT** accessible from the internet

### 🔐 HTTPS with Self-Signed Certificates

For local development, the proxy uses self-signed SSL certificates:

- **Certificate**: `certs/localhost.crt`
- **Private Key**: `certs/localhost.key`
- **Valid For**: 365 days
- **Subject Alternative Names**: `DNS:localhost`, `IP:127.0.0.1`

**Browser Security Warning:**
Your browser will show a security warning because the certificate is self-signed. This is **expected and safe** for local development. Click "Advanced" → "Proceed to localhost" to continue.

### 🛡️ Security Headers

The proxy adds modern security headers to all responses:

```nginx
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### 📍 Real IP Forwarding

The proxy passes the real client IP to the sidecar for accurate rate limiting and logging:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

The Rust sidecar uses the `X-Real-IP` header to enforce rate limits per actual client, not per proxy.

## Setup

### 1. Generate SSL Certificates

**Linux/Mac/WSL:**
```bash
cd infra/nginx
bash generate-certs.sh
```

**Windows (PowerShell):**
```powershell
cd infra\nginx
.\generate-certs.ps1
```

**Git Bash (Windows):**
```bash
cd infra/nginx
bash generate-certs.sh
```

This creates:
- `certs/localhost.crt` - Self-signed certificate
- `certs/localhost.key` - Private key

### 2. Build and Run

From the `deploy/` directory:

```bash
# Build nginx image
docker compose build nginx

# Start nginx and dependencies
docker compose up -d nginx

# View logs
docker compose logs -f nginx
```

## Configuration

### Nginx Configuration

The main configuration is in [sidecar.conf](sidecar.conf).

**Key settings:**

```nginx
# SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;

# Proxy configuration
location / {
    proxy_pass http://sidecar;
    proxy_set_header X-Real-IP $remote_addr;
    
    # Long timeouts for update operations
    proxy_read_timeout 300s;
}
```

### Environment Variables

None required - nginx is configured via files.

### Volumes

```yaml
volumes:
  # Configuration (read-only)
  - ../infra/nginx/sidecar.conf:/etc/nginx/conf.d/default.conf:ro
  - ../infra/nginx/certs:/etc/nginx/certs:ro
  
  # Logs (persistent)
  - nginx-logs:/var/log/nginx
```

## Usage

### Update OurBlock via HTTPS

```bash
# From your local machine
curl -X POST https://localhost:4443/update \
  -H "X-OurBlock-Admin-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"version": "0.1.1"}' \
  --insecure  # Required for self-signed cert
```

### Check Health

```bash
curl https://localhost:4443/health --insecure
```

### Frontend Integration

Update your UI to use HTTPS:

```typescript
// ui/src/pages/SystemPage.tsx
const response = await fetch('https://localhost:4443/update', {
  method: 'POST',
  headers: {
    'X-OurBlock-Admin-Key': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ version: latestVersion }),
});
```

## Architecture

```
┌─────────────────────┐
│  Browser (UI)       │
│  https://app.local  │
└──────────┬──────────┘
           │ HTTPS (localhost only)
           │ https://127.0.0.1:4443/update
           │ X-OurBlock-Admin-Key: xxx
           ▼
┌───────────────────────────────┐
│   Nginx Reverse Proxy         │
│  - HTTPS termination          │
│  - Localhost binding          │
│  - Security headers           │
│  - X-Real-IP forwarding       │
└──────────┬────────────────────┘
           │ HTTP (internal network)
           │ http://sidecar:3001/update
           │ + X-Real-IP: 127.0.0.1
           ▼
┌───────────────────────────────┐
│   Rust Sidecar (Axum)         │
│  - API key authentication     │
│  - Rate limiting by real IP   │
│  - Structured logging         │
└──────────┬────────────────────┘
           │ Docker commands
           │ tcp://socket-proxy:2375
           ▼
┌───────────────────────────────┐
│   Socket Proxy (Firewall)     │
│  - ALLOW_RESTARTS=1 only      │
└──────────┬────────────────────┘
           │
           ▼
┌───────────────────────────────┐
│   Docker Engine               │
└───────────────────────────────┘
```

## Communication Flow

When you click "Update" in the browser:

1. **Frontend** → `https://localhost:4443/update` + API Key
2. **Nginx** → Validates HTTPS, adds `X-Real-IP` header
3. **Nginx** → Proxies to `http://sidecar:3001/update`
4. **Sidecar** → Validates API key (from header)
5. **Sidecar** → Checks rate limit (by `X-Real-IP`)
6. **Sidecar** → Logs: `[INFO] Update requested by 127.0.0.1 - Authorized`
7. **Sidecar** → Sends restart command to socket-proxy
8. **Socket Proxy** → Verifies "restart" is allowed
9. **Docker** → Pulls and restarts containers

## Logs

### View Access Logs

```bash
# Via docker
docker compose exec nginx tail -f /var/log/nginx/sidecar-access.log

# Via volume
docker volume inspect deploy_nginx-logs
```

### View Error Logs

```bash
docker compose exec nginx tail -f /var/log/nginx/sidecar-error.log
```

### Log Format

```
127.0.0.1 - - [17/Jan/2026:12:00:00 +0000] "POST /update HTTP/2.0" 200 45 "-" "curl/7.81.0"
```

## Production Deployment

### Use Real Certificates

Replace self-signed certificates with Let's Encrypt or a commercial CA:

```bash
# Install certbot
sudo apt install certbot

# Generate certificate (requires public domain)
sudo certbot certonly --standalone -d yourapp.com

# Update docker-compose.yaml
volumes:
  - /etc/letsencrypt/live/yourapp.com:/etc/nginx/certs:ro
```

### Update Nginx Config

```nginx
ssl_certificate /etc/nginx/certs/fullchain.pem;
ssl_certificate_key /etc/nginx/certs/privkey.pem;
```

### Remove Localhost Binding (Optional)

If you need external access (e.g., for a public server):

```yaml
ports:
  - "443:443"  # Allow all interfaces
  - "80:80"
```

**⚠️ WARNING:** This exposes the update API to your network. Ensure strong API keys and consider IP whitelisting.

## Troubleshooting

### "Connection refused" from browser

**Check nginx is running:**
```bash
docker compose ps nginx
```

**Check port binding:**
```bash
docker compose port nginx 443
# Should output: 127.0.0.1:4443
```

### "SSL certificate problem: self signed certificate"

This is expected with self-signed certificates. Options:

1. **Accept in browser:** Click "Advanced" → "Proceed to localhost"
2. **Use `--insecure` with curl:** `curl --insecure https://localhost:4443`
3. **Install CA certificate:** Import `certs/localhost.crt` to your OS trust store

### "502 Bad Gateway"

Nginx can't reach the sidecar. Check:

```bash
# Verify sidecar is running
docker compose ps sidecar

# Verify both are on secure-admin-net
docker network inspect deploy_secure-admin-net

# Check nginx logs
docker compose logs nginx
```

### "Real IP shows as proxy IP"

Verify nginx is passing the header:

```bash
# Check nginx config
docker compose exec nginx cat /etc/nginx/conf.d/default.conf | grep X-Real-IP

# Should see: proxy_set_header X-Real-IP $remote_addr;
```

## Development

### Test Locally Without Docker

```bash
# Install nginx
sudo apt install nginx

# Copy config
sudo cp sidecar.conf /etc/nginx/sites-available/sidecar
sudo ln -s /etc/nginx/sites-available/sidecar /etc/nginx/sites-enabled/

# Copy certificates
sudo mkdir -p /etc/nginx/certs
sudo cp certs/* /etc/nginx/certs/

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

### Customize Timeouts

For longer update operations, adjust timeouts in [sidecar.conf](sidecar.conf):

```nginx
proxy_connect_timeout 60s;   # Connection timeout
proxy_send_timeout 300s;     # Send timeout (5 minutes)
proxy_read_timeout 300s;     # Read timeout (5 minutes)
```

## Security Checklist

- ✅ Localhost-only binding (`127.0.0.1:4443`)
- ✅ HTTPS with TLS 1.2+
- ✅ Self-signed certificates generated
- ✅ Security headers enabled
- ✅ X-Real-IP forwarding for rate limiting
- ✅ API key authentication (sidecar layer)
- ✅ Rate limiting (sidecar layer)
- ✅ Socket proxy firewall (Docker layer)
- ✅ Internal-only network (`secure-admin-net`)
- ✅ Structured logging

## File Structure

```
infra/nginx/
├── Dockerfile              # Nginx container image
├── sidecar.conf           # Nginx proxy configuration
├── generate-certs.sh      # Certificate generation (Linux/Mac)
├── generate-certs.ps1     # Certificate generation (Windows)
├── .gitignore            # Ignore certificates
├── README.md             # This file
└── certs/                # SSL certificates (generated)
    ├── localhost.crt     # Certificate
    └── localhost.key     # Private key
```

## License

MIT
