# OurBlock Hub - Home Assistant Add-on

A 24/7 Holochain seed node that provides neighborhood coordination services. The Hub acts as a "Super-Peer" that:

- Runs a full Holochain conductor with 24/7 DHT participation
- Serves the React UI via HTTPS to any device on the local network
- Announces itself via mDNS as `ourblock.local` for zero-config discovery
- Provides WebSocket endpoints for mobile app connections
- Acts as a "Web-Bridge" (Holo Hosting pattern) for browser-only users

## Installation

### From Home Assistant UI (Recommended)

1. Navigate to **Settings** → **Add-ons** → **Add-on Store**
2. Click the **⋮** menu (top right) → **Repositories**
3. Add this repository URL: `https://github.com/Pixel-Pilot28/OurBlock`
4. Find **OurBlock Hub** in the add-on list
5. Click **Install**
6. Configure your neighborhood name (optional)
7. Click **Start**

### Manual Installation

```bash
# SSH into your Home Assistant machine
cd /addons
git clone https://github.com/Pixel-Pilot28/OurBlock
cd OurBlock/ourblock-hub

# Install from local
ha addons install --repository /addons/OurBlock --addon ourblock-hub
```

## Configuration

```yaml
neighborhood_name: "My Neighborhood"  # Display name for your community
admin_password: ""                    # Leave empty to auto-generate
enable_vouching: true                 # Require vouching for new members
log_level: info                       # trace|debug|info|warn|error
```

## First-Time Setup

After starting the add-on:

1. **Access the UI**: Navigate to `https://ourblock.local` or click **Open Web UI** in Home Assistant
2. **Save your admin password**: Check the add-on logs for the auto-generated password
3. **Create your profile**: Set up your neighborhood admin account
4. **Generate invite codes**: Share codes with neighbors to join your network

## Access Points

- **Web UI**: `https://ourblock.local` (or `https://<your-ha-ip>:4443`)
- **Mobile WebSocket**: `ws://ourblock.local:8888`
- **Admin API**: `https://ourblock.local/api` (requires API key)

## Architecture

### Hub as Web-Bridge (Tier 1)

The Hub serves the React UI to any browser that visits its local IP. When a non-tech neighbor accesses the Hub, it acts as a **Proxy Conductor** following the Holo Hosting pattern. This means:

- The Hub handles Holochain conductor calls on their behalf
- Source chains are stored on the Hub
- The Hub gossips data 24/7 to the neighborhood DHT

### Peer-Sovereign Identity

- **No central user database**: Each neighbor's mobile app generates its own Agent Keypair
- **Hub stores Source Chains**: The Hub merely stores and gossips chains, it doesn't "own" accounts
- **Vouching for authorization**: New agents must be vouched in by existing members

### Discovery via mDNS

The Hub announces itself on the local network as `ourblock.local` using mDNS/Bonjour. This enables:

- **Zero-config access**: Users just type `ourblock.local` in their browser
- **Mobile app discovery**: Apps can find the Hub without manual IP entry
- **Works on all platforms**: Compatible with iOS (Bonjour), Android (NSD), and desktop

## Hardware Requirements

### Minimum (Raspberry Pi 3)
- **CPU**: ARM Cortex-A53 (4 cores)
- **RAM**: 1GB
- **Storage**: 8GB SD card
- **Network**: Ethernet or Wi-Fi
- **Expected performance**: 5-10 active users

### Recommended (Raspberry Pi 4/5)
- **CPU**: ARM Cortex-A72 (4 cores)
- **RAM**: 2GB or more
- **Storage**: 16GB+ SD card (or SSD for better performance)
- **Network**: Gigabit Ethernet
- **Expected performance**: 20-50 active users

### Optimal (Intel NUC or Proxmox)
- **CPU**: Intel i3 or better (x86_64)
- **RAM**: 4GB+
- **Storage**: 32GB+ SSD
- **Network**: Gigabit Ethernet
- **Expected performance**: 100+ active users

## Networking

The Hub uses the following ports:

- **443** (HTTPS): React UI served via nginx
- **8888** (WebSocket): Holochain conductor for mobile apps
- **5353** (UDP): mDNS for `ourblock.local` discovery

Make sure these ports are not blocked by your firewall.

## Backups

Holochain data is stored in `/share/ourblock/` and is automatically backed up by Home Assistant's snapshot system.

**Manual backup:**
```bash
# Via Home Assistant CLI
ha addons backup ourblock-hub

# Via Web UI
Settings → System → Backups → Create Backup → Select OurBlock Hub
```

## Troubleshooting

### Can't access `ourblock.local`

- **Check mDNS support**: Some routers block mDNS/Bonjour traffic
- **Use IP address**: Access via `https://<ha-ip-address>:4443`
- **Check logs**: Settings → Add-ons → OurBlock Hub → Logs

### Mobile apps can't connect

- **Firewall**: Ensure port 8888 is not blocked
- **Network isolation**: Make sure mobile devices are on the same network
- **Use IP fallback**: Connect to `ws://<ha-ip-address>:8888`

### Services won't start

- **Check Docker**: The Hub requires Docker to be running
- **View logs**: `docker compose logs -f` in the add-on terminal
- **Rebuild images**: Remove `/app/.images_built` and restart the add-on

### Out of disk space

- **Check usage**: `df -h` in the add-on terminal
- **Clean old data**: Settings → System → Storage → Clean up
- **Expand storage**: Use a larger SD card or SSD

## Development

To test changes locally:

```bash
# Build the add-on
docker build -t ourblock-hub home-assistant/

# Run in standalone mode
docker run -p 4443:443 -p 8888:8888 -v $(pwd)/data:/config ourblock-hub
```

## Support

- **Documentation**: https://docs.ourblock.app
- **Issues**: https://github.com/yourusername/ourblock/issues
- **Community**: Join our neighborhood at `https://ourblock.local` (if you have access to a Hub)

## License

MIT License - See LICENSE file for details
