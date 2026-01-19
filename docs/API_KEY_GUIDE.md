# OurBlock API Key Guide

## Current Setup

### Authentication Architecture

OurBlock uses a **three-layer security model**:

1. **Socket Proxy** - Filters Docker API access
2. **Rust Sidecar** - API gateway with key authentication & rate limiting  
3. **Nginx Reverse Proxy** - HTTPS termination (⚠️ currently not exposing ports on Windows)

## Testing Now (Development)

### Default API Key

The default API key is: `change-me-in-production`

Location: `deploy/.env`
```bash
ADMIN_API_KEY=change-me-in-production
```

### Current Access Methods

#### ✅ Option 1: Direct Internal Access (Works Now)

Access the sidecar directly from inside the Docker network:

```powershell
# From another container
docker exec ourblock-conductor curl -H "X-OurBlock-Admin-Key: change-me-in-production" http://sidecar:3001/version
```

#### ✅ Option 2: Expose Sidecar Port Temporarily (For Testing)

**Add to `deploy/docker-compose.yaml` sidecar service:**

```yaml
sidecar:
  # ... existing config ...
  ports:
    - "3001:3001"  # Temporarily expose for testing
```

Then restart:
```powershell
cd deploy
docker compose up -d sidecar
```

**Test with curl:**
```powershell
$apiKey = "change-me-in-production"

# Health (no auth)
curl.exe http://localhost:3001/health

# Version (requires auth)
curl.exe -H "X-OurBlock-Admin-Key: $apiKey" http://localhost:3001/version

# Trigger update (requires auth + rate limited)
curl.exe -X POST -H "X-OurBlock-Admin-Key: $apiKey" -H "Content-Type: application/json" -d '{\"version\":\"0.1.1\"}' http://localhost:3001/update
```

**Test with PowerShell:**
```powershell
$apiKey = "change-me-in-production"
$headers = @{
    "X-OurBlock-Admin-Key" = $apiKey
}

# Health check
Invoke-RestMethod -Uri "http://localhost:3001/health"

# Version info
Invoke-RestMethod -Uri "http://localhost:3001/version" -Headers $headers

# Trigger update
$body = @{ version = "0.1.1" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/update" -Method Post -Headers $headers -Body $body -ContentType "application/json"
```

#### ⚠️ Option 3: Fix Nginx Port Binding (Recommended but currently not working on Windows)

The nginx service should expose HTTPS on port 4443, but Docker Desktop on Windows has issues with port bindings in some configurations.

**Troubleshooting nginx:**
```powershell
cd deploy

# Remove and recreate nginx
docker compose rm -f nginx
docker compose up -d nginx

# Check if ports are bound
docker port ourblock-nginx-proxy
# Should show: 443/tcp -> 0.0.0.0:4443
#             80/tcp -> 0.0.0.0:8080

# If not working, try without Docker Compose
docker run -d --name test-nginx -p 4443:443 -p 8080:80 nginx:alpine
docker port test-nginx
```

### Frontend Integration (For UI Testing)

**Update `ui/.env.local`:**
```bash
VITE_ADMIN_API_KEY=change-me-in-production
VITE_SIDECAR_URL=http://localhost:3001
```

**In your React code** (`ui/src/pages/SystemPage.tsx`):
```typescript
const API_KEY = import.meta.env.VITE_ADMIN_API_KEY;
const SIDECAR_URL = import.meta.env.VITE_SIDECAR_URL || 'https://localhost:4443';

const headers = {
  'X-OurBlock-Admin-Key': API_KEY,
  'Content-Type': 'application/json',
};

// Update endpoint
fetch(`${SIDECAR_URL}/update`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ version: '0.1.1' }),
});
```

### Rate Limiting

The sidecar enforces **1 request per 5 minutes per IP** for update/restart endpoints.

If you hit the rate limit:
```json
{
  "error": "Too many requests"
}
```

**Wait 5 minutes or restart the sidecar:**
```powershell
docker compose restart sidecar
```

## Production Deployment

### 1. Generate Strong API Key

**Using PowerShell:**
```powershell
# Generate 32-byte random key
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$apiKey = [Convert]::ToBase64String($bytes)
Write-Host $apiKey
```

**Using Git Bash / Linux:**
```bash
openssl rand -base64 32
```

**Using online tool:**
https://www.random.org/strings/ (32 characters, alphanumeric + symbols)

### 2. Configure Backend

**Update `deploy/.env`:**
```bash
ADMIN_API_KEY=your-super-secret-key-here-32-bytes-minimum
```

**Restart sidecar:**
```powershell
cd deploy
docker compose restart sidecar nginx
```

### 3. Configure Frontend

**Update `ui/.env.local`:**
```bash
VITE_ADMIN_API_KEY=your-super-secret-key-here-32-bytes-minimum
```

**Rebuild UI:**
```powershell
cd ui
npm run build
docker compose up -d ui --build
```

### 4. Secure the Key

#### Option A: Environment Variables (Simple)

Keep the key in `.env` files (already .gitignored).

**Pros:**
- Simple to set up
- Standard practice
- Works with Docker Compose

**Cons:**
- Key stored in plaintext on disk
- Accessible to anyone with file access

#### Option B: Docker Secrets (Recommended for Production)

**Create secret:**
```powershell
# Create secrets directory
mkdir -p deploy/secrets

# Generate and save key
$apiKey = "your-generated-key-here"
$apiKey | Out-File -FilePath deploy/secrets/admin_api_key.txt -NoNewline
```

**Update `docker-compose.yaml`:**
```yaml
secrets:
  admin_api_key:
    file: ./secrets/admin_api_key.txt

services:
  sidecar:
    secrets:
      - admin_api_key
    environment:
      - ADMIN_API_KEY_FILE=/run/secrets/admin_api_key
```

**Update sidecar to read from file** (modify `infra/sidecar/src/main.rs`):
```rust
let admin_api_key = match std::env::var("ADMIN_API_KEY_FILE") {
    Ok(file_path) => std::fs::read_to_string(file_path)?.trim().to_string(),
    Err(_) => std::env::var("ADMIN_API_KEY")
        .unwrap_or_else(|_| "change-me-in-production".to_string()),
};
```

#### Option C: HashiCorp Vault / AWS Secrets Manager (Enterprise)

For production infrastructure, use a dedicated secrets management service:

**HashiCorp Vault:**
```bash
# Store secret
vault kv put secret/ourblock/api-key value="your-key-here"

# Retrieve in app
vault kv get -field=value secret/ourblock/api-key
```

**AWS Secrets Manager:**
```bash
# Store secret
aws secretsmanager create-secret --name ourblock-api-key --secret-string "your-key-here"

# Retrieve in app
aws secretsmanager get-secret-value --secret-id ourblock-api-key --query SecretString
```

### 5. Network Security

#### Localhost-Only Binding (Linux/macOS)

**In `docker-compose.yaml`:**
```yaml
nginx:
  ports:
    - "127.0.0.1:4443:443"  # Only accessible from localhost
    - "127.0.0.1:8080:80"
```

**On Windows:** This may not work with Docker Desktop. Consider:
1. Use Windows Firewall to block external access to ports
2. Run OurBlock in WSL2 for proper network isolation
3. Use a VPN for remote access

#### Firewall Rules (Windows)

**Block external access to sidecar port:**
```powershell
# Block inbound on port 4443 except from localhost
New-NetFirewallRule -DisplayName "OurBlock Sidecar - Block External" `
    -Direction Inbound -LocalPort 4443 -Protocol TCP `
    -Action Block -RemoteAddress Any

# Allow from localhost only  
New-NetFirewallRule -DisplayName "OurBlock Sidecar - Allow Localhost" `
    -Direction Inbound -LocalPort 4443 -Protocol TCP `
    -Action Allow -RemoteAddress 127.0.0.1
```

### 6. API Key Rotation

**Rotation schedule:** Every 90 days recommended.

**Process:**
1. Generate new key
2. Update `deploy/.env` with new key
3. Update `ui/.env.local` with new key
4. Restart services: `docker compose restart sidecar nginx ui`
5. Update any automation/scripts using the old key
6. Document the rotation in your security log

**Automate with cron:**
```bash
# /etc/cron.monthly/rotate-ourblock-key.sh
#!/bin/bash
NEW_KEY=$(openssl rand -base64 32)
echo "ADMIN_API_KEY=$NEW_KEY" > /opt/ourblock/deploy/.env
docker compose -f /opt/ourblock/deploy/docker-compose.yaml restart sidecar nginx
echo "$(date): Rotated API key" >> /var/log/ourblock-security.log
```

### 7. Additional Security Layers

#### mTLS (Mutual TLS)

For zero-trust environments, require client certificates:

**Generate client cert:**
```bash
# Create CA
openssl genrsa -out ca-key.pem 4096
openssl req -new -x509 -days 3650 -key ca-key.pem -out ca.pem

# Create client cert
openssl genrsa -out client-key.pem 4096
openssl req -new -key client-key.pem -out client.csr
openssl x509 -req -days 365 -in client.csr -CA ca.pem -CAkey ca-key.pem -out client.pem
```

**Configure nginx:**
```nginx
server {
    listen 443 ssl;
    ssl_client_certificate /etc/nginx/certs/ca.pem;
    ssl_verify_client on;
    # ... rest of config
}
```

#### IP Whitelisting

**In nginx config** (`infra/nginx/sidecar.conf`):
```nginx
# Only allow specific IPs
location /update {
    allow 192.168.1.100;  # Your admin machine
    allow 10.0.0.0/8;     # Internal network
    deny all;
    
    proxy_pass http://sidecar;
}
```

#### VPN Access Only

Require VPN connection to access the update API:

1. **Tailscale** (easiest):
   ```bash
   # Install Tailscale
   curl -fsSL https://tailscale.com/install.sh | sh
   
   # Start Tailscale
   tailscale up
   
   # Bind nginx to Tailscale IP only
   # In docker-compose.yaml:
   - "100.x.x.x:4443:443"  # Your Tailscale IP
   ```

2. **WireGuard**:
   - Set up WireGuard server
   - Only allow WireGuard subnet to access ports

## Security Checklist

### Development
- [ ] Use default key from `.env`
- [ ] Never commit `.env` files to git
- [ ] Test authentication with curl/PowerShell
- [ ] Verify rate limiting works
- [ ] Check logs for unauthorized attempts

### Staging
- [ ] Generate random 32-byte API key
- [ ] Update both backend and frontend `.env` files
- [ ] Test with production-like network config
- [ ] Verify localhost-only binding (if possible)
- [ ] Document key in secure location

### Production
- [ ] Generate cryptographically random API key (32+ bytes)
- [ ] Store key in secrets management system (Vault, AWS Secrets Manager)
- [ ] Enable localhost-only binding OR firewall rules
- [ ] Set up API key rotation schedule (90 days)
- [ ] Enable structured logging aggregation
- [ ] Set up alerts for unauthorized access attempts
- [ ] Consider adding mTLS for zero-trust
- [ ] Restrict network access via VPN if possible
- [ ] Document incident response process
- [ ] Regular security audits

## Troubleshooting

### "Invalid or missing API key"

**Check:**
1. Header name is exactly `X-OurBlock-Admin-Key`
2. Key matches the value in `deploy/.env`
3. No extra whitespace in the key
4. Sidecar has been restarted after `.env` change

**Debug:**
```powershell
# Check sidecar logs
docker logs ourblock-sidecar --tail=50

# Look for:
# "Using default API key" = using fallback
# "Unauthorized access attempt" = wrong key
```

### "Rate limit exceeded"

Wait 5 minutes between update requests, or restart sidecar:
```powershell
docker compose restart sidecar
```

### "Cannot connect to sidecar"

**Check if sidecar is running:**
```powershell
docker ps | Select-String "sidecar"
```

**Check if port is exposed (if you added it):**
```powershell
docker port ourblock-sidecar
# Should show: 3001/tcp -> 0.0.0.0:3001
```

**Check sidecar logs:**
```powershell
docker logs ourblock-sidecar
```

### Nginx port binding not working (Windows)

**Known issue with Docker Desktop on Windows.**

**Workarounds:**
1. **Temporarily expose sidecar port** (see Option 2 above)
2. **Use WSL2** for proper Linux networking
3. **Use Docker in a Linux VM** (VirtualBox, Hyper-V)
4. **Wait for Docker Desktop update** that fixes port binding

## References

- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Nginx Security](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)

## Support

For security issues, contact: security@ourblock.local (update with real contact)

**Last Updated:** January 17, 2026  
**Version:** 1.0.0
