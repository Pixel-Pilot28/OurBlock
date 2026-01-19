# OurBlock

A self-hosted, decentralized neighborhood community platform built on [Holochain](https://holochain.org) using the Neighborhoods framework.

**For End Users:** See [DEPLOYMENT.md](DEPLOYMENT.md) for installation instructions via Holochain Launcher.

**For Developers:** See development setup below.

---

## Vision

OurBlock treats a "neighborhood" as a modular unit—not just a social feed, but a toolkit where communities can plug in modules like:

- **The Block Feed** - Chronological updates and local alerts with reactions & comments
- **The Tool Shed** - Shared item library with image storage in DHT
- **Neighborhood Events** - Community events with RSVP system and capacity management
- **Shared Spaces** - Reservation system for shared amenities (rooftop, grill, etc.)
- **Helping Hands** - Mutual aid request/offer board
- **Circle Chat** - Private/group messaging

## Architecture

OurBlock uses a **Hybrid P2P** architecture with two tiers:

### Tier 1: OurBlock Hub (Super-Peer)
A 24/7 seed node that serves as the neighborhood's local infrastructure:
- **Deployment**: Home Assistant Add-on (Raspberry Pi recommended)
- **Services**: Holochain conductor, mDNS discovery, WebSocket gateway
- **Purpose**: DHT participation, web-bridge for browser users, peer discovery

### Tier 2: User Apps (Sovereign Clients)
Individual community members can connect as:
- **Mobile Apps**: Own cryptographic keys, full peer autonomy (React Native - coming soon)
- **Web Users**: Hub-proxied keys for easy access via browser

**Key Features:**
- 🔒 **Zero Trust Invites**: OURBLOCK_V1 invite codes with cryptographic signatures
- 🌐 **Local-First**: mDNS discovery (ourblock.local) for same-network devices
- 🚀 **Global Bootstrap**: Holochain bootstrap server for NAT traversal
- 📱 **Zero Config**: Join with a single invite code, no IP addresses or complex setup

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for complete architecture documentation.

## Deployment Options

### Option 1: Home Assistant Add-on (Recommended)

The easiest way to run an OurBlock Hub on a Raspberry Pi or home server:

1. Install the OurBlock Add-on from Home Assistant
2. Configure neighborhood name and settings
3. Share invite codes with neighbors

See [docs/HOME_ASSISTANT_DEPLOYMENT.md](docs/HOME_ASSISTANT_DEPLOYMENT.md) for details.

### Option 2: Docker Compose

For manual deployment on any Linux server:

```bash
docker-compose up -d
```

See [deploy/README.md](deploy/README.md) for configuration details.

### Option 3: Holochain Launcher

For end users who just want to join (no Hub hosting):

See [DEPLOYMENT.md](DEPLOYMENT.md) for installation via Holochain Launcher.

## Quick Start for New Neighbors

### Joining an Existing Neighborhood

If someone in your neighborhood is already hosting an OurBlock Hub:

1. Ask them for an invite code
2. Navigate to the Hub's address (e.g., `http://ourblock.local` or the Hub's IP)
3. Click "Join with Invite Code"
4. Paste your invite code
5. Done! You're now connected to your neighborhood network

### Testing the Join Flow (Development)

See [docs/TESTING_JOIN_FLOW.md](docs/TESTING_JOIN_FLOW.md) for complete testing instructions.

Quick test:
```bash
# Terminal 1: Start the Hub
docker-compose up -d

# Terminal 2: Start the UI
cd ui && npm run dev

# Navigate to http://localhost:5173/join
# Enter a test invite code (see testing guide for generation)
```

## Development Environment Setup

### Prerequisites

You need [Nix](https://nixos.org/download.html) installed with flakes enabled.

#### Installing Nix

**Linux/macOS/WSL:**
```bash
curl -L https://nixos.org/nix/install | sh
```

**Windows:**
OurBlock development requires WSL2 (Windows Subsystem for Linux) with Nix installed inside it.

1. Install WSL2: `wsl --install` in PowerShell (Admin)
2. Open your WSL distribution and install Nix there

#### Enabling Flakes

Add to `~/.config/nix/nix.conf` (create if it doesn't exist):
```
experimental-features = nix-command flakes
```

### Entering the Development Shell

```bash
# Clone the repository (if you haven't)
git clone <repo-url> OurBlock
cd OurBlock

# Enter the development environment
nix develop

# Or, for automatic shell entry when you cd into the directory:
# Install direnv and run: direnv allow
```

### Verifying the Environment

Once inside the Nix shell, verify Holochain tools are available:

```bash
# Check Holochain CLI
hc --version

# Check conductor
holochain --version

# Check keystore
lair-keystore --version
```

---

## Project Structure

```
OurBlock/
├── flake.nix                      # Nix flake for dev environment
├── Cargo.toml                     # Rust workspace configuration
├── dnas/
│   └── our_block/
│       ├── workdir/
│       │   └── dna.yaml           # DNA manifest
│       └── zomes/
│           ├── integrity/
│           │   └── profile/       # Profile validation rules
│           └── coordinator/
│               └── profile/       # Profile business logic
├── workdir/
│   └── happ.yaml                  # hApp manifest
├── ui/                            # React/TypeScript frontend
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── contexts/              # React contexts (Holochain)
│   │   └── types/                 # TypeScript type definitions
│   └── package.json
└── tests/                         # Integration tests (planned)
```

---

## Running the App Locally

### Step 1: Enter the Development Environment

**On Windows (requires WSL2):**
```powershell
# From PowerShell, enter WSL
wsl

# Navigate to your project (path may vary)
cd /mnt/c/.../OurBlock

# Enter the Nix development shell
nix develop
```

**On Linux/macOS:**
```bash
cd OurBlock
nix develop
```

### Step 2: Build the Zomes

Inside the Nix shell, compile all the WASM zomes:

```bash
# Build all zomes in release mode
cargo build --release --target wasm32-unknown-unknown
```

### Step 3: Package the DNA and hApp

```bash
# Package the DNA
hc dna pack dnas/our_block/workdir -o dnas/our_block/workdir/our_block.dna

# Package the hApp
hc app pack workdir -o workdir/our_block.happ
```

### Step 4: Run the Holochain Sandbox

```bash
# Create and run a sandbox conductor with our hApp
hc sandbox generate workdir/our_block.happ --run=8888 -a our_block
```

This will:
- Generate a new conductor configuration
- Install your hApp
- Start the conductor on port 8888

**Keep this terminal running!**

### Step 5: Start the UI Development Server

Open a **new terminal** (also in WSL/Nix shell):

```bash
cd ui

# Install dependencies (first time only)
pnpm install

# Start the Vite dev server
pnpm dev
```

The UI should now be available at `http://localhost:5173`

---

## Quick Start Script

For convenience, you can run everything with these commands:

**Terminal 1 (Holochain backend):**
```bash
nix develop
cargo build --release --target wasm32-unknown-unknown
hc dna pack dnas/our_block/workdir -o dnas/our_block/workdir/our_block.dna
hc app pack workdir -o workdir/our_block.happ
hc sandbox generate workdir/our_block.happ --run=8888 -a our_block
```

**Terminal 2 (React frontend):**
```bash
nix develop
cd ui && pnpm install && pnpm dev
```

---

## Testing with Multiple Agents

To test features like vouching and chat, you need multiple agents:

```bash
# Terminal 1: First agent on port 8888
hc sandbox generate workdir/our_block.happ --run=8888 -a our_block

# Terminal 2: Second agent on port 8889
hc sandbox generate workdir/our_block.happ --run=8889 -a our_block
```

Then adjust the WebSocket port in the UI (or run two UI instances pointing to different ports).

---

## Troubleshooting

### "Command not found: hc"
Make sure you're inside the Nix development shell:
```bash
nix develop
```

### Build errors
Try cleaning and rebuilding:
```bash
cargo clean
cargo build --release --target wasm32-unknown-unknown
```

### Port already in use
Kill existing conductor processes:
```bash
pkill holochain
pkill lair-keystore
```

### WSL networking issues
Access the UI from Windows browser using the WSL IP or `localhost`.

---

## Development Workflow

### Branch Strategy
- One branch per small task: `feature/vouch-logic`, `fix/dht-sync-bug`

### Commit Convention
Use conventional commits:
- `feat: add vouch validation`
- `fix: resolve dht sync bug`
- `docs: update README`
- `refactor: extract validation helpers`

### Integrity First Rule
In Holochain, always define the **Integrity Zome** (rules) before the **Coordinator Zome** (functions).

---

## Upcoming Features

### In Progress
- **Hub Admin UI**: Web interface for generating and managing invite codes
- **QR Code Integration**: Scan invite codes instead of typing them
- **React Native Mobile App**: Full peer autonomy on iOS/Android

### Planned
- **Multi-Hub Failover**: Automatic switching between multiple Hub instances
- **Bootstrap Server Monitoring**: Health checks and analytics for peer discovery
- **Enhanced Revocation**: Real-time DHT propagation of revoked invitations
- **Offline-First Improvements**: Better local-network-only operation

## Implemented Features

### Neighborhood Join Flow
Zero-configuration onboarding for new neighbors:

1. **Hub Admin** generates an invite code via the Hub
2. **New Neighbor** enters the code at `/join`
3. **App Auto-Installs** with proper network configuration
4. **Instant Access** to neighborhood features

**Invite Code Format:**
```
OURBLOCK_V1:[NetworkSeed]:[Timestamp]:[Signature]
```

Features:
- ✅ Real-time validation with visual feedback
- ✅ Cryptographic membrane proof verification
- ✅ 7-day expiration window
- ✅ Revocation support (Hub can invalidate codes)
- ✅ Progress tracking during installation

See [docs/INVITATION_SYSTEM.md](docs/INVITATION_SYSTEM.md) for complete documentation.

### Settings & System Management
Navigate to Settings (gear icon) to access:

- **Account & Profile** (`/settings/profile`) - Manage your profile information
- **Data & System** (`/settings/system`) - Advanced system management:
  - **Data Health Check**: Verify sync status with DHT network
  - **Backup/Restore**: Export and import your complete source chain and keystore
  - **Auto-Update**: Check for and install Docker container updates via sidecar service

### Sidecar Management Service
For self-hosted Docker deployments, the sidecar service enables in-app updates:

```bash
cd sidecar
npm install
npm start  # Runs on http://localhost:3001
```

The sidecar handles Docker operations that the containerized app cannot perform directly:
- Version checking against Docker Hub
- Triggering `docker compose pull && docker compose up -d`
- Health monitoring and restart orchestration

See [sidecar/README.md](sidecar/README.md) for full documentation.

---

## License
This project is licensed under the MIT License.


---
## Contributing
Please submit pull requests or open issues for feature requests and bug reports. If you would like to work on this project, feel free to reach out!
