# Production Deployment - API Key Setup Guide

## Quick Start

The strong API key has been generated and saved to `deploy/.secrets/admin_api_key.txt`.

**⚠️ IMPORTANT:** Never commit this file to git! It's already in `.gitignore`.

---

## Option 1: Docker Secrets (Recommended for Production)

### 1. Create Docker Secret

```bash
cd deploy
docker secret create ourblock_admin_key .secrets/admin_api_key.txt
```

### 2. Update docker-compose.yaml

Add to your services that need the API key:

```yaml
services:
  sidecar:
    secrets:
      - ourblock_admin_key
    environment:
      ADMIN_API_KEY_FILE: /run/secrets/ourblock_admin_key

secrets:
  ourblock_admin_key:
    external: true
```

### 3. Update Sidecar Code

Modify `infra/sidecar/src/main.rs` to read from file:

```rust
fn get_admin_api_key() -> String {
    if let Ok(key_file) = std::env::var("ADMIN_API_KEY_FILE") {
        std::fs::read_to_string(key_file)
            .expect("Failed to read API key from file")
            .trim()
            .to_string()
    } else {
        std::env::var("ADMIN_API_KEY")
            .expect("ADMIN_API_KEY or ADMIN_API_KEY_FILE must be set")
    }
}
```

---

## Option 2: Environment Variable (Development/Testing)

### 1. Copy API Key to .env

```bash
cd deploy
cp .secrets/admin_api_key.txt .env
# Then manually edit .env to add ADMIN_API_KEY=<paste key here>
```

Or use this one-liner:

```bash
echo "ADMIN_API_KEY=$(cat .secrets/admin_api_key.txt)" >> .env
```

### 2. Verify .env File

```bash
cat .env | grep ADMIN_API_KEY
# Should output: ADMIN_API_KEY=<your-secure-key>
```

---

## Option 3: Cloud Secrets Manager

### AWS Secrets Manager

```bash
# Store the secret
aws secretsmanager create-secret \
    --name ourblock/admin-api-key \
    --secret-string file://deploy/.secrets/admin_api_key.txt

# Retrieve in your app (e.g., in docker-entrypoint.sh)
export ADMIN_API_KEY=$(aws secretsmanager get-secret-value \
    --secret-id ourblock/admin-api-key \
    --query SecretString \
    --output text)
```

### Azure Key Vault

```bash
# Store the secret
az keyvault secret set \
    --vault-name yourblock-vault \
    --name admin-api-key \
    --file deploy/.secrets/admin_api_key.txt

# Retrieve in your app
export ADMIN_API_KEY=$(az keyvault secret show \
    --vault-name yourblock-vault \
    --name admin-api-key \
    --query value \
    --output tsv)
```

---

## Verifying Security

### Check if API Key is Secure

```bash
# Length should be 32-33 characters
wc -c deploy/.secrets/admin_api_key.txt
# Output: 33 (or 32 + newline)

# Should contain mix of letters, numbers, upper/lower case
cat deploy/.secrets/admin_api_key.txt
```

### Test API Key Authentication

```bash
# Should fail with wrong key
curl -X GET https://localhost:4443/version \
    -H "X-OurBlock-Admin-Key: wrong-key" \
    --insecure
# Expected: 401 Unauthorized

# Should succeed with correct key
API_KEY=$(cat deploy/.secrets/admin_api_key.txt)
curl -X GET https://localhost:4443/version \
    -H "X-OurBlock-Admin-Key: $API_KEY" \
    --insecure
# Expected: 200 OK with version info
```

---

## Rotating the API Key

### When to Rotate
- Every 90 days (recommended)
- After team member departure
- If key is suspected to be compromised
- Before major deployments

### How to Rotate

```powershell
# Generate new key (PowerShell)
cd deploy
$newKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$newKey | Out-File -FilePath ".secrets/admin_api_key.txt" -NoNewline -Encoding ASCII
Write-Host "New API key generated"
```

```bash
# Generate new key (Linux/macOS)
cd deploy
openssl rand -base64 32 > .secrets/admin_api_key.txt
echo "New API key generated"
```

### Update Running Services

```bash
# Update Docker secret
docker secret rm ourblock_admin_key
docker secret create ourblock_admin_key .secrets/admin_api_key.txt

# Restart services to pick up new secret
docker service update --force ourblock_sidecar
docker service update --force ourblock_nginx
```

---

## Backup and Recovery

### Backup API Key (Secure Location)

```bash
# Encrypt and backup
gpg --symmetric --cipher-algo AES256 deploy/.secrets/admin_api_key.txt
# Creates: admin_api_key.txt.gpg

# Store encrypted backup in secure location
# (Password manager, encrypted backup drive, etc.)
```

### Restore from Backup

```bash
# Decrypt
gpg --decrypt admin_api_key.txt.gpg > deploy/.secrets/admin_api_key.txt

# Verify
cat deploy/.secrets/admin_api_key.txt
```

---

## Troubleshooting

### Service Can't Authenticate

**Symptom:** Sidecar returns 401 Unauthorized

**Check:**
1. API key file exists: `ls -la deploy/.secrets/admin_api_key.txt`
2. Environment variable set: `docker exec ourblock-sidecar env | grep ADMIN_API_KEY`
3. No extra whitespace in key file: `cat -A deploy/.secrets/admin_api_key.txt`

**Fix:**
```bash
# Remove any trailing newlines or spaces
tr -d '\n\r' < deploy/.secrets/admin_api_key.txt > temp.txt
mv temp.txt deploy/.secrets/admin_api_key.txt

# Restart service
docker compose restart sidecar
```

### Key Too Short/Long

**Symptom:** "API key must be at least 32 characters"

**Fix:**
```bash
# Regenerate with correct length
openssl rand -base64 32 | tr -d '\n' > deploy/.secrets/admin_api_key.txt
```

---

## Security Best Practices

✅ **DO:**
- Use Docker secrets in production
- Rotate keys every 90 days
- Use cloud secrets manager for multi-server deployments
- Keep encrypted backups
- Monitor API key usage (failed auth attempts)

❌ **DON'T:**
- Commit API key to git
- Share key via email/Slack
- Use same key across environments (dev/staging/prod)
- Log the API key value
- Store unencrypted on shared drives

---

## UI Configuration

The UI also needs the API key for admin operations. Update the UI's environment:

```bash
# ui/.env.production
VITE_ADMIN_API_KEY=<copy-from-deploy/.secrets/admin_api_key.txt>
```

**Note:** The UI key is embedded in the client bundle. For production, consider:
1. Loading from a secure backend endpoint
2. Using a separate, more restricted "read-only" key
3. Implementing user-based authentication

---

## Next Steps

1. ✅ API key generated and saved
2. ⬜ Choose deployment method (Docker secrets recommended)
3. ⬜ Update docker-compose.yaml
4. ⬜ Test authentication
5. ⬜ Set up monitoring for failed auth attempts
6. ⬜ Schedule 90-day key rotation reminder

**Questions?** See [SECURITY_FIXES_COMPLETE.md](SECURITY_FIXES_COMPLETE.md) for full security audit details.
