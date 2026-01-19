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
