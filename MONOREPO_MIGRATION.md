# OurBlock Monorepo Reorganization - Complete ✅

## Summary

Successfully reorganized OurBlock into a **monorepo structure** with two deployment strategies:

### Repository Structure

```
OurBlock/
├── dnas/               # Shared Holochain DNA code (Rust zomes)
├── ui/                 # Shared React UI (TypeScript/Vite)
└── infra/              # Infrastructure & deployment
    ├── docker-general/ # Standard Docker Compose deployment
    ├── ha-addon/       # Home Assistant Add-on (S6-supervised)
    │   ├── old-docker-in-docker/  # Failed approach (archived)
    │   ├── Dockerfile            # Alpine + direct binary install
    │   ├── config.yaml           # HA add-on config (v0.2.0)
    │   ├── README.md             # HA add-on documentation
    │   └── rootfs/               # S6 service definitions
    ├── sidecar/        # Rust WebSocket/REST sidecar service
    └── nginx/          # Reverse proxy configurations
```

## What Changed

### 1. Moved Standard Deployment
- **From**: `/deploy/*`
- **To**: `/infra/docker-general/*`
- **Why**: Consolidate all infrastructure under `/infra` and distinguish from HA-specific build

### 2. Archived Failed HA Approach
- **From**: `/ourblock-hub/*`
- **To**: `/infra/ha-addon/old-docker-in-docker/*`
- **Why**: Docker-in-docker fundamentally incompatible with Home Assistant security model
  - HA blocks `CAP_NET_ADMIN` and `CAP_SYS_ADMIN` kernel capabilities
  - Even `full_access: true` cannot enable docker networking inside HA containers
  - iptables/nf_tables operations fail with "operation not permitted"

### 3. Created New S6-Based HA Add-on
- **Location**: `/infra/ha-addon/*`
- **Version**: 0.2.0
- **Architecture**: S6-overlay process supervision (single container, multiple processes)

## New HA Add-on Architecture

### Direct Binary Installation
Instead of running docker-compose inside a container, binaries are installed directly:
- **Holochain**: v0.4.0 (amd64/arm64/armv7)
- **Lair Keystore**: v0.5.2 (amd64/arm64/armv7)
- **Sidecar**: Built from source during Docker build

### S6 Service Definitions

All services run as processes managed by S6-overlay:

1. **lair-keystore** (longrun)
   - Initializes lair on first run
   - Generates passphrase if not provided in config
   - Starts keystore server on Unix socket

2. **holochain** (longrun)
   - **Depends on**: lair-keystore
   - Generates conductor-config.yaml dynamically
   - Starts Holochain conductor on port 8888

3. **sidecar** (longrun)
   - **Depends on**: holochain
   - Auto-generates admin API key if empty
   - Starts Rust sidecar on port 3000

4. **nginx** (longrun)
   - **Depends on**: sidecar
   - Reverse proxy for HTTPS (port 4443)
   - Proxies `/api/*` to sidecar

5. **mdns** (longrun)
   - Avahi daemon for `ourblock.local` discovery

6. **init-ourblock** (oneshot)
   - One-time SSL certificate generation

### Service Dependencies

```
lair-keystore
    ↓
holochain
    ↓
sidecar
    ↓
nginx
```

## Configuration

### Home Assistant Add-on Config (`config.yaml`)
- **Host Networking**: `host_network: true` for mDNS discovery
- **Ingress**: Port 4443 (HTTPS)
- **Options**: Neighborhood name, lair passphrase (optional)

### Dockerfile
- **Base**: Alpine Linux (small footprint)
- **Binaries**: Direct curl downloads from GitHub releases
- **Build**: Clones OurBlock repo, builds Rust sidecar
- **S6**: Installs s6-overlay for process supervision

## Next Steps

### 1. Test HA Add-on Build
```bash
# In Home Assistant
1. Add repository: https://github.com/Pixel-Pilot28/OurBlock
2. Refresh add-on store
3. Install "OurBlock Hub" add-on
4. Start and monitor logs
```

### 2. Expected Behavior
- S6 should start services in dependency order
- Lair initializes and creates keystore
- Holochain conductor connects to lair and starts
- Sidecar connects to conductor admin interface
- Nginx proxies HTTPS to sidecar
- Avahi advertises `ourblock.local`

### 3. Verify Logs
```bash
# In HA add-on logs
[lair-keystore] Initializing lair-keystore...
[lair-keystore] Starting lair-keystore...
[holochain] Starting Holochain conductor...
[sidecar] Starting sidecar on port 3000...
[nginx] Starting nginx...
[mdns] Starting avahi-daemon...
```

### 4. Test Web Interface
- Navigate to `https://[HA_IP]:4443` or `https://ourblock.local`
- Should see OurBlock UI
- Join flow should work with invite codes

## Deployment Comparison

| Feature | docker-general | ha-addon |
|---------|---------------|----------|
| **Orchestration** | Docker Compose | S6-overlay |
| **Containers** | 5 separate containers | 1 container, 5 processes |
| **Target** | Any Docker host | Home Assistant only |
| **Config** | .env file | HA add-on config |
| **Networking** | Docker networks | Host networking |
| **Discovery** | Docker DNS | mDNS (avahi) |
| **SSL** | Self-signed cert | Self-signed cert |
| **Updates** | `docker-compose pull` | HA add-on update |

## Repository Status

✅ **Committed**: defb7cb - "Reorganize into monorepo structure with S6-based HA add-on"
✅ **Pushed**: origin/main
✅ **Files Changed**: 190 files (516 insertions, 261 deletions)

## Documentation

- **Main README**: Updated to document monorepo structure
- **HA Add-on README**: [infra/ha-addon/README.md](../infra/ha-addon/README.md)
- **Docker General README**: [infra/docker-general/README.md](../infra/docker-general/README.md)

## Lessons Learned

### Why Docker-in-Docker Failed
1. **Security Model**: HA intentionally blocks kernel capabilities needed for docker networking
2. **Capabilities**: `CAP_NET_ADMIN`, `CAP_SYS_ADMIN` required but blocked
3. **iptables**: Cannot modify iptables/nf_tables from inside HA container
4. **MTU Settings**: Bridge interface creation fails with "operation not permitted"

### Why S6-Overlay Works
1. **Process-Based**: No nested containerization, just process supervision
2. **HA Standard**: S6 is the official HA add-on process manager
3. **Dependencies**: S6 handles service startup order and dependencies
4. **Simplicity**: Single container with multiple processes is HA best practice

## Open Questions

1. **UI Build**: Should we pre-build the UI or build during Docker build?
   - Current: Dockerfile clones repo and could build UI
   - Alternative: Build UI in CI/CD and include as artifact

2. **DNA Compilation**: Should DNAs be pre-compiled or compiled during build?
   - Current: Assumes DNAs are already compiled in repo
   - Alternative: Compile during Docker build (requires Rust toolchain)

3. **Binary Caching**: Should we cache Holochain/Lair binaries?
   - Current: Downloads every build
   - Alternative: Multi-stage build with cached layer

## Contact

For issues or questions about the monorepo reorganization:
- GitHub Issues: https://github.com/Pixel-Pilot28/OurBlock/issues
- HA Add-on Logs: Home Assistant → Add-ons → OurBlock Hub → Logs
