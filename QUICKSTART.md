# OurBlock Hub - Quick Start Guide

## What is OurBlock Hub?

OurBlock Hub is a **24/7 neighborhood coordination server** that:
- Runs a full Holochain node for your community
- Serves a web UI to any device on your network
- Enables mobile apps to connect via WebSocket
- Announces itself as `ourblock.local` for easy discovery

## Architecture

```
OurBlock Hub (Tier 1)        User Apps (Tier 2)
┌────────────────────┐       ┌─────────────┐
│ Holochain Conductor│◄─────►│ Mobile Apps │
│ React Web UI       │       │ (Own Keys)  │
│ mDNS Discovery     │       └─────────────┘
│ 24/7 Availability  │       ┌─────────────┐
└────────────────────┘◄─────►│ Web Clients │
                              │ (Hub Keys)  │
                              └─────────────┘
```

**Deployment Options:**
1. **Home Assistant Add-on** (Recommended - one-click install)
2. **Docker Compose** (Power users - see below)
3. **Raspberry Pi Image** (Coming soon)

## Prerequisites

- Docker Desktop running
- PowerShell terminal

## Start OurBlock

### Option 1: Using Script (Recommended)

In PowerShell:
```
cd C:\Users\JVanD\Projects\OurBlock\deploy
.\start.ps1
```

### Option 2: Manual Start

In PowerShell:
# Navigate to deploy directory
cd C:\Users\JVanD\Projects\OurBlock\deploy

# Set environment
$env:COMPOSE_FILE = "docker-compose.yaml"

# Build images (first time only, or after code changes)
docker compose build sidecar nginx

# Start services in order
docker compose up -d socket-proxy
Start-Sleep -Seconds 3

docker compose up -d sidecar nginx
Start-Sleep -Seconds 3

docker compose up -d lair-keystore ourblock
Start-Sleep -Seconds 5

docker compose up -d ui

# Check status
docker compose ps
```

## Access Points

- **Web UI**: https://ourblock.local (or https://\<hub-ip\>:4443)
- **Mobile WebSocket**: ws://ourblock.local:8888
- **Admin API**: https://ourblock.local/api (requires API key)

## What Neighbors See

### Web Users (Browser)
1. Visit `https://ourblock.local` on any device
2. Enter invite code from Hub admin
3. Start using OurBlock (Hub manages their keys)

### Mobile Users (App)
1. Download OurBlock app from App Store / Play Store
2. Tap "Join Neighborhood"
3. Enter invite code
4. App generates keys locally (sovereign identity)
5. Connects to Hub at `ws://ourblock.local:8888`

## For Hub Administrators

### Creating Invite Codes

Once the Hub is running, visit the admin panel to generate invite codes:

```
https://ourblock.local/admin
```

Click "Generate Invite" and share the code (QR code or text) with your neighbors.

**Invite codes now contain:**
- **Hub Address** (e.g., `https://hub1.yourblock.com` or `192.168.1.100:8888`)
- **Network Seed** (isolates your neighborhood DHT)
- **Timestamp** (when invite was created)
- **Signature** (validates authenticity)
- **Expiration** (default: 7 days)

**New Format:** `OURBLOCK_V1:[HubAddress]:[NetworkSeed]:[Timestamp]:[Signature]`

**Mobile apps** automatically extract the hub address and connect to the correct server.

**Connection Status:** Watch the status indicator in the header:
- 🟢 **Synced** - Connected to peers
- 🟡 **Searching** - Looking for peers via bootstrap
- 🔵 **Connecting** - Establishing connections
- 🔴 **Offline** - No connection

## Stop OurBlock

In PowerShell:
```
cd C:\Users\JVanD\Projects\OurBlock\deploy
.\stop.ps1
```

Or manually:
```
cd C:\Users\JVanD\Projects\OurBlock\deploy
docker compose down
```

## View Logs

```powershell
# All services
docker compose logs -f

# Specific service
docker compose logs -f ui
docker compose logs -f sidecar
docker compose logs -f ourblock
```

## Troubleshooting

###  "no configuration file provided"

Make sure you're in the `deploy/` directory and set the COMPOSE_FILE environment variable:

```powershell
cd C:\Users\JVanD\Projects\OurBlock\deploy
$env:COMPOSE_FILE = "docker-compose.yaml"
```

### Build is taking too long

The Rust sidecar can take 5-10 minutes to build the first time. Subsequent builds are faster due to caching.

### Service won't start

Check logs for the specific service:

```powershell
docker compose logs sidecar
```

### Reset everything

```powershell
docker compose down -v  # Warning: deletes all data
docker compose build --no-cache
```

## API Key Configuration

The default API key is `change-me-in-production`. To change it:

1. Edit `deploy/.env`
2. Set `ADMIN_API_KEY=your-secure-key-here`  
3. Edit `ui/.env.local` (create if missing)
4. Set `VITE_ADMIN_API_KEY=your-secure-key-here` (must match deploy/.env)
5. Restart services: `docker compose restart sidecar ui`

Generate a secure key:

```powershell
# Using PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Or using Git Bash
openssl rand -base64 32
```
