# OurBlock Quick Reference

A quick reference for common tasks and commands in OurBlock.

## Table of Contents

- [For Neighbors (End Users)](#for-neighbors-end-users)
- [For Hub Admins](#for-hub-admins)
- [For Developers](#for-developers)
- [Troubleshooting](#troubleshooting)

---

## For Neighbors (End Users)

### Joining a Neighborhood

1. **Get an invite code** from your neighbor who runs the Hub
   - Format: `OURBLOCK_V1:...`
   - Valid for 7 days

2. **Navigate to the Hub**
   - Local network: `http://ourblock.local`
   - Or use the IP address your neighbor provides

3. **Enter your code**
   - Click "Join with Invite Code"
   - Paste the code
   - Wait for automatic setup (1-2 minutes)

4. **Start using OurBlock!**
   - Post updates
   - Share tools
   - Chat with neighbors
   - RSVP to events

### Using OurBlock

**Main Features:**
- 📰 **Feed**: See what's happening in your neighborhood
- 🔧 **Tool Shed**: Borrow and lend tools
- 📅 **Events**: Neighborhood gatherings and activities
- 🏛️ **Spaces**: Reserve shared amenities
- 💬 **Chat**: Direct and group messaging

**Settings:**
- Click the gear icon (⚙️) in the top navigation
- **Profile**: Update your name, bio, avatar
- **System**: Backup your data, check sync status

---

## For Hub Admins

### Setting Up a Hub

#### Option 1: Home Assistant Add-on (Recommended)

1. **Install the add-on**
   - Home Assistant → Settings → Add-ons
   - Click "Add-on Store" → Search "OurBlock"
   - Install and configure

2. **Configure**
   ```yaml
   neighborhood_name: "Maple Street"
   enable_vouching: true
   admin_password: "auto"  # Auto-generated on first run
   ```

3. **Start the add-on**
   - The Hub will be available at `http://ourblock.local`
   - Check logs for the admin password

#### Option 2: Docker Compose

1. **Clone the repository**
   ```bash
   git clone <repo-url> OurBlock
   cd OurBlock
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit configuration
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Check status**
   ```bash
   docker-compose ps
   docker-compose logs -f holochain
   ```

### Managing Invitations

#### Generate an Invite Code (CLI)

```bash
# Connect to Holochain admin websocket
hc sandbox call-admin --port 4444 \
  generate_invitation \
  '{"neighbor_name": "Alice", "voucher": null}'
```

**Output:**
```json
{
  "invite_code": "OURBLOCK_V1:maple-street-2024:1735689600000000:dGVzd...",
  "invitation_hash": "uhCkk...",
  "created_at": 1735689600000000,
  "expires_at": 1736294400000000
}
```

Share the `invite_code` with your neighbor.

#### List All Invitations

```bash
hc sandbox call-admin --port 4444 list_invitations '{}'
```

#### Revoke an Invitation

```bash
hc sandbox call-admin --port 4444 \
  revoke_invitation \
  '{"invitation_hash": "uhCkk..."}'
```

### Hub Admin UI (Coming Soon)

A web interface will allow you to:
- Generate invites with a form
- View all invitations in a table
- Revoke invitations with a button click
- Generate QR codes for easy sharing

**Temporary workaround**: Use CLI commands above

### Monitoring the Hub

#### Check Holochain Status

```bash
# View logs
docker logs -f ourblock-holochain-1

# Check running apps
hc sandbox call-admin --port 4444 list_apps '{}'

# Check network peers
hc sandbox call-admin --port 4444 dump_network_stats '{}'
```

#### Check mDNS Discovery

**Linux/Mac:**
```bash
avahi-browse -r _ourblock._tcp
```

**Expected output:**
```
+ eth0 IPv4 OurBlock Hub - Maple Street       _ourblock._tcp       local
```

#### Check System Resources

```bash
# Docker stats
docker stats ourblock-holochain-1

# Disk usage
docker system df

# Logs size
docker logs ourblock-holochain-1 2>&1 | wc -l
```

### Backup and Restore

#### Backup Hub Data

```bash
# Backup Holochain conductor data
docker exec ourblock-holochain-1 tar czf - /data \
  > ourblock-backup-$(date +%Y%m%d).tar.gz

# Backup entire Docker volumes
docker run --rm -v ourblock_holochain_data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/hub-backup-$(date +%Y%m%d).tar.gz /data
```

#### Restore Hub Data

```bash
# Stop containers
docker-compose down

# Restore from backup
docker run --rm -v ourblock_holochain_data:/data \
  -v $(pwd):/backup alpine \
  tar xzf /backup/hub-backup-YYYYMMDD.tar.gz -C /

# Restart
docker-compose up -d
```

### Updating the Hub

#### Docker Compose

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Clean up old images
docker image prune -a
```

#### Home Assistant Add-on

1. Home Assistant → Settings → Add-ons
2. Click OurBlock → Update (if available)
3. Restart the add-on

---

## For Developers

### Development Setup

```bash
# Enter Nix shell
nix develop

# Build WASM zomes
cargo build --release --target wasm32-unknown-unknown

# Package DNA
hc dna pack dnas/our_block/workdir

# Package hApp
hc app pack workdir

# Run conductor
hc sandbox generate workdir/our_block.happ --run=8888 -a our_block
```

### Frontend Development

```bash
# Install dependencies
cd ui
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### Running Tests

```bash
# Rust tests
cargo test

# TypeScript tests (when implemented)
cd ui
npm test
```

### Common Development Tasks

#### Add a New Zome Function

1. **Define in integrity zome** (if needed)
   ```rust
   // dnas/our_block/zomes/integrity/profile/src/lib.rs
   #[hdk_entry_helper]
   pub struct MyEntry { ... }
   ```

2. **Implement in coordinator zome**
   ```rust
   // dnas/our_block/zomes/coordinator/profile/src/lib.rs
   #[hdk_extern]
   pub fn my_function(input: MyInput) -> ExternResult<MyOutput> { ... }
   ```

3. **Rebuild**
   ```bash
   cargo build --release --target wasm32-unknown-unknown
   hc dna pack dnas/our_block/workdir
   ```

#### Update UI Component

1. **Edit component**
   ```typescript
   // ui/src/components/MyComponent.tsx
   export function MyComponent() { ... }
   ```

2. **Hot reload automatically updates** (Vite dev server)

#### Test with Multiple Agents

```bash
# Terminal 1: Agent 1
hc sandbox generate workdir/our_block.happ --run=8888 -a our_block

# Terminal 2: Agent 2
hc sandbox generate workdir/our_block.happ --run=8889 -a our_block
```

Update UI to connect to different ports for testing.

### Project Structure

```
OurBlock/
├── dnas/our_block/
│   ├── workdir/dna.yaml           # DNA configuration
│   └── zomes/
│       ├── integrity/profile/     # Validation rules
│       └── coordinator/profile/   # Business logic
├── ui/
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── contexts/              # State management
│   │   ├── pages/                 # Route components
│   │   └── utils/                 # Helper functions
│   └── package.json
├── home-assistant/                # HA add-on files
├── infra/
│   ├── sidecar/                   # Rust gateway service
│   └── nginx/                     # Reverse proxy config
└── docs/                          # Documentation
```

### Key Files

- **DNA Properties**: `dnas/our_block/workdir/dna.yaml`
- **Invite System**: `dnas/our_block/zomes/coordinator/profile/src/lib.rs`
- **Join Component**: `ui/src/pages/JoinNeighborhood.tsx`
- **Invite Utilities**: `ui/src/utils/inviteCode.ts`
- **Environment Config**: `ui/.env.local`

---

## Troubleshooting

### "Cannot connect to Holochain"

**Check if conductor is running:**
```bash
docker ps | grep holochain
# OR
ps aux | grep holochain
```

**Check port bindings:**
```bash
# Admin port (default 4444)
curl http://localhost:4444

# App port (default 8888)
curl http://localhost:8888
```

**Restart conductor:**
```bash
docker-compose restart holochain
```

### "Invalid membrane proof"

**Causes:**
1. Expired invite code (>7 days)
2. Network seed mismatch
3. Invalid signature
4. Hub agent key changed

**Solutions:**
```bash
# Generate new invite
hc sandbox call-admin --port 4444 generate_invitation '{"neighbor_name": "Test"}'

# Check DNA properties
hc dna show-properties dnas/our_block/workdir/our_block.dna

# Check conductor logs
docker logs ourblock-holochain-1 | grep membrane
```

### "mDNS discovery not working"

**Linux:**
```bash
# Install avahi
sudo apt-get install avahi-daemon avahi-utils

# Check service
systemctl status avahi-daemon

# Test discovery
avahi-browse -a
```

**macOS:**
```bash
# mDNS is built-in (Bonjour)
dns-sd -B _ourblock._tcp
```

**Windows:**
- mDNS may require Bonjour Print Services
- Use IP address instead: `http://192.168.1.100`

### "Network peers not connecting"

**Check bootstrap server connectivity:**
```bash
curl https://bootstrap.holochain.org
```

**Check conductor network config:**
```bash
docker exec ourblock-holochain-1 cat /data/conductor-config.yaml
```

**View network stats:**
```bash
hc sandbox call-admin --port 4444 dump_network_stats '{}'
```

### "UI not loading after join"

**Hard refresh the browser:**
- Windows/Linux: `Ctrl + Shift + R`
- macOS: `Cmd + Shift + R`

**Check browser console:**
- F12 → Console tab
- Look for WebSocket errors

**Verify app installation:**
```bash
hc sandbox call-admin --port 4444 list_apps '{}'
# Should show: ourblock-{networkSeed}
```

### Development Issues

**"Command not found: hc"**

Make sure you're in the Nix shell:
```bash
nix develop
hc --version  # Should work now
```

**Build errors**

```bash
# Clean and rebuild
cargo clean
cargo build --release --target wasm32-unknown-unknown
```

**Port conflicts**

```bash
# Kill existing processes
pkill holochain
pkill lair-keystore

# Or change ports
hc sandbox generate workdir/our_block.happ --run=9999 -a our_block
```

---

## Quick Commands Cheatsheet

### Hub Management
```bash
# Start Hub
docker-compose up -d

# Stop Hub
docker-compose down

# View logs
docker logs -f ourblock-holochain-1

# Generate invite
hc sandbox call-admin --port 4444 generate_invitation '{"neighbor_name": "Alice"}'
```

### Development
```bash
# Build zomes
cargo build --release --target wasm32-unknown-unknown

# Package DNA
hc dna pack dnas/our_block/workdir

# Run conductor
hc sandbox generate workdir/our_block.happ --run=8888 -a our_block

# Start UI
cd ui && npm run dev
```

### Debugging
```bash
# Check apps
hc sandbox call-admin --port 4444 list_apps '{}'

# Check network
hc sandbox call-admin --port 4444 dump_network_stats '{}'

# View source chain
hc sandbox call --port 8888 our_block profile get_my_profile '{}'
```

---

## Resources

### Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design and data flow
- [INVITATION_SYSTEM.md](INVITATION_SYSTEM.md) - Invite code specification
- [HOME_ASSISTANT_DEPLOYMENT.md](HOME_ASSISTANT_DEPLOYMENT.md) - HA deployment guide
- [TESTING_JOIN_FLOW.md](TESTING_JOIN_FLOW.md) - Join flow testing guide

### External Resources
- [Holochain Documentation](https://docs.holochain.org)
- [HDK Reference](https://docs.rs/hdk/)
- [Holochain Client](https://www.npmjs.com/package/@holochain/client)
- [Home Assistant Add-on Development](https://developers.home-assistant.io/docs/add-ons/)

### Community
- [Holochain Forum](https://forum.holochain.org)
- [Holochain Discord](https://discord.gg/holochain)

---

## Need Help?

1. **Check the docs** in the `docs/` folder
2. **Search issues** on GitHub
3. **Ask in Discord** (Holochain community)
4. **Open an issue** with:
   - Your setup (Docker/HA/Dev)
   - Error messages
   - Steps to reproduce
   - Relevant logs
