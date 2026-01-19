# Deploying OurBlock Hub on Home Assistant

## Prerequisites

- Home Assistant OS, Supervised, or Container installation
- Docker support enabled
- At least 2GB RAM available
- Stable network connection

## Installation Methods

### Method 1: From Add-on Store (When Published)

1. Navigate to **Settings** → **Add-ons** → **Add-on Store**
2. Search for "OurBlock Hub"
3. Click **Install**
4. Wait for installation to complete (5-10 minutes)
5. Click **Start**

### Method 2: Manual Repository Installation (Development)

1. Navigate to **Settings** → **Add-ons** → **Add-on Store**
2. Click the **⋮** menu (top right)
3. Select **Repositories**
4. Add repository URL: `https://github.com/Pixel-Pilot28/OurBlock`
5. Click **Add**
6. Refresh the page
7. Find **OurBlock Hub** in the local add-ons section
8. Click **Install**

### Method 3: Local Development

If you're developing the add-on locally:

```bash
# SSH into your Home Assistant machine
ssh root@homeassistant.local

# Navigate to addons directory
cd /addons

# Clone the repository
git clone https://github.com/Pixel-Pilot28/OurBlock
cd OurBlock

# Install from local
ha addons install --repository /addons/OurBlock --addon ourblock-hub

# Start the add-on
ha addons start ourblock-hub
```

## Configuration

After installation, before starting:

1. Click on **OurBlock Hub** in the add-ons list
2. Go to the **Configuration** tab
3. Adjust settings:

```yaml
neighborhood_name: "Maple Street"  # Your neighborhood's name
admin_password: ""                 # Leave empty to auto-generate (recommended)
enable_vouching: true              # Require existing members to vouch for new members
log_level: info                    # trace|debug|info|warn|error
```

4. Click **Save**
5. Go to the **Info** tab
6. Click **Start**

### Configuration Options Explained

#### `neighborhood_name`
- **Default**: "My Neighborhood"
- **Purpose**: Display name shown in the UI and mobile apps
- **Examples**: "Maple Street", "Downtown Co-op", "Pine Valley"

#### `admin_password`
- **Default**: "" (auto-generated)
- **Purpose**: API key for admin operations (updates, restarts)
- **Recommendation**: Leave empty for auto-generation
- **Security**: Auto-generated keys are 32-byte random strings

#### `enable_vouching`
- **Default**: `true`
- **Purpose**: Require existing members to vouch for new joiners
- **When to disable**: Small trusted communities, early testing
- **When to enable**: Public neighborhoods, security-focused communities

#### `log_level`
- **Default**: `info`
- **Options**: `trace`, `debug`, `info`, `warn`, `error`
- **Recommendation**: Use `info` for normal operation, `debug` for troubleshooting

## First-Time Setup

After starting the add-on for the first time:

### 1. Check the Logs

1. Go to the **Log** tab
2. Look for the startup message:

```
🚀 OurBlock Hub Sidecar starting on http://0.0.0.0:3001
   Version: 0.1.0
   Neighborhood: Maple Street
   mDNS: ourblock.local
```

3. If you see errors, check the **Troubleshooting** section below

### 2. Save Your Admin Password

If you left `admin_password` empty, check the logs for:

```
Auto-generated admin password: <random-base64-string>
Save this password! You can change it in the add-on configuration.
```

**Important**: Copy this password and store it securely (password manager, encrypted notes).

### 3. Access the Web UI

Open your browser and visit:

```
https://ourblock.local
```

Or use your Home Assistant's IP:

```
https://<ha-ip-address>:4443
```

**Note**: You may see a security warning about a self-signed certificate. This is expected - click "Advanced" → "Proceed" to continue.

### 4. Create Your Admin Profile

1. Enter your nickname, bio, and avatar (optional)
2. Click "Create Profile"
3. You're now the neighborhood admin!

### 5. Generate Invite Codes

1. Navigate to **Settings** → **System**
2. Click "Generate Invite Code"
3. Optionally select a voucher (yourself or another member)
4. Copy the code (e.g., `OB-V1-A7F3E2D9...`)
5. Share with your neighbors

## Sharing Invite Codes

### Via QR Code (Recommended)

1. Generate invite code in the UI
2. Click "Generate QR Code"
3. Show the QR code to your neighbor
4. They scan it with the mobile app

### Via Text

1. Generate invite code
2. Copy the full code (including `OB-V1-` prefix)
3. Share via:
   - Text message
   - Email
   - Printed flyer
   - Word of mouth (for short codes)

**Security Note**: Invite codes expire after 7 days by default. Generate new codes for new neighbors.

## Network Access

### Local Network Access (Default)

By default, OurBlock Hub is accessible on your local network:

- **Web UI**: `https://ourblock.local` or `https://<hub-ip>:4443`
- **Mobile WebSocket**: `ws://ourblock.local:8888`

### Remote Access (Optional)

If you want neighbors to access the Hub from outside your network:

#### Option 1: Tailscale (Recommended)

1. Install Tailscale on your Home Assistant
2. Install Tailscale on neighbors' devices
3. Share your Tailscale hostname: `https://homeassistant.tailscale-name.ts.net:4443`

**Pros**: Encrypted, easy setup, works anywhere
**Cons**: Requires Tailscale account

#### Option 2: Port Forwarding (Not Recommended)

1. Forward ports 443 and 8888 on your router
2. Use dynamic DNS to get a stable hostname
3. Share the URL: `https://your-hostname.dyndns.org:4443`

**Pros**: Direct access
**Cons**: Exposes Hub to internet, security risk

#### Option 3: Cloudflare Tunnel

1. Install Cloudflare Tunnel add-on in Home Assistant
2. Configure tunnel for OurBlock Hub
3. Share the Cloudflare URL

**Pros**: No port forwarding, DDoS protection
**Cons**: Requires Cloudflare account, more complex setup

## Backups

### Automatic Backups (via Home Assistant)

Home Assistant automatically includes add-on data in system snapshots.

**To create a manual backup:**

1. Navigate to **Settings** → **System** → **Backups**
2. Click **Create Backup**
3. Select **OurBlock Hub** (or do a full backup)
4. Wait for completion
5. Download the backup file (optional)

**Backup includes:**
- Holochain source chains
- Neighborhood configuration
- User profiles
- All DHT data

### Restore from Backup

1. Navigate to **Settings** → **System** → **Backups**
2. Select the backup to restore
3. Click **Restore**
4. Choose **Partial Restore** → **OurBlock Hub**
5. Confirm and wait for restoration

**Note**: Restoring will overwrite current data. Coordinate with your neighborhood before restoring an old backup.

## Updating the Hub

### Automatic Updates (Recommended)

1. Enable auto-updates in Home Assistant:
   - **Settings** → **Add-ons** → **OurBlock Hub**
   - Enable "Auto update"

2. Hub will update automatically when new versions are released

### Manual Updates

1. Navigate to **Settings** → **Add-ons** → **OurBlock Hub**
2. If an update is available, click **Update**
3. Wait for update to complete
4. Restart if prompted

**Note**: Updates preserve your data and configuration.

## Monitoring

### Logs

**Real-time logs:**
1. Go to **Add-ons** → **OurBlock Hub** → **Log**
2. Enable "Auto-refresh" to see live updates

**Common log messages:**

```bash
# Normal operation
🚀 OurBlock Hub Sidecar starting on http://0.0.0.0:3001
🌐 Discovery: Announcing as ourblock.local
WebSocket connection established

# Errors
Failed to bind to address
Docker daemon not ready
mDNS service registration failed
```

### Health Checks

Check if the Hub is healthy:

```bash
# Via curl (SSH into HA)
curl https://localhost:4443/api/health

# Expected response
{"status":"ok","timestamp":"2026-01-18T12:34:56.789Z"}
```

### Resource Usage

Check resource consumption:

1. Go to **Settings** → **System** → **System Info**
2. Look for "OurBlock Hub" under Add-ons
3. Monitor CPU, RAM, and disk usage

**Typical usage:**
- CPU: 5-15% (idle), 30-50% (active)
- RAM: 500MB - 1GB
- Disk: 100MB (base) + ~10MB per active user

## Troubleshooting

### Hub Won't Start

**Symptom**: Add-on shows "Stopped" or "Error" status

**Solutions**:

1. **Check logs** for specific error messages
2. **Increase RAM**: Ensure at least 2GB available
3. **Check Docker**: Ensure Home Assistant has Docker support
4. **Restart Home Assistant**: Sometimes needed after first install

### Can't Access `ourblock.local`

**Symptom**: Browser shows "Can't resolve hostname"

**Solutions**:

1. **Use IP address instead**: `https://<ha-ip>:4443`
2. **Check mDNS support**: Some routers block mDNS/Bonjour
3. **Check network**: Ensure device is on same network as Hub
4. **Check firewall**: Ensure port 4443 is not blocked

### Mobile Apps Can't Connect

**Symptom**: Mobile app shows "Connection failed"

**Solutions**:

1. **Check WebSocket port**: Ensure port 8888 is accessible
2. **Use IP address**: `ws://<ha-ip>:8888` instead of `ourblock.local`
3. **Check firewall**: Some networks block WebSocket traffic
4. **Check logs**: Look for "WebSocket connection" messages

### "Invalid API Key" Errors

**Symptom**: Admin operations fail with 401 Unauthorized

**Solutions**:

1. **Check password**: Ensure you're using the correct admin password
2. **Regenerate password**: Change `admin_password` in config and restart
3. **Check headers**: Ensure `X-OurBlock-Admin-Key` header is set

### "Permission Denied" in Logs

**Symptom**: Logs show permission errors

**Solutions**:

1. **Check volume permissions**: Add-on may need access to `/share`
2. **Restart Home Assistant**: Fixes most permission issues
3. **Reinstall add-on**: Delete and reinstall if permissions are corrupted

### Hub Uses Too Much Disk Space

**Symptom**: Disk usage grows over time

**Solutions**:

1. **Prune Docker**: Run `docker system prune -a` via SSH
2. **Clean DHT data**: In OurBlock UI, go to Settings → System → Clean DHT
3. **Expand storage**: Use external USB drive or larger SD card

## Advanced Configuration

### Custom DNS Name

Instead of `ourblock.local`, use a custom hostname:

1. Edit `run.sh` in the add-on container
2. Change `MDNS_HOSTNAME` environment variable
3. Restart add-on

### Multiple Neighborhoods

Run multiple Hubs for different neighborhoods:

1. Install OurBlock Hub multiple times (rename each instance)
2. Configure different neighborhoods in each
3. Use different ports for each Hub

### Performance Tuning

For large neighborhoods (50+ users):

1. **Increase resources**: Allocate more RAM in Docker settings
2. **Use SSD**: Move data directory to SSD instead of SD card
3. **Dedicated hardware**: Consider Intel NUC or Proxmox instead of Pi

## Security Best Practices

1. **Use strong admin password**: Don't use default, generate random
2. **Enable vouching**: Prevent spam accounts
3. **Limit network access**: Don't expose to internet without VPN
4. **Regular backups**: Weekly backups to external storage
5. **Monitor logs**: Check for unauthorized access attempts
6. **Update regularly**: Enable auto-updates for security patches

## Support

- **Documentation**: https://docs.ourblock.app
- **Community Forum**: https://forum.ourblock.app
- **GitHub Issues**: https://github.com/yourusername/ourblock/issues
- **Discord**: https://discord.gg/ourblock (community support)

## License

OurBlock Hub is open source under the MIT License.
