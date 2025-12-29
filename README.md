# 🏘️ OurBlock

A self-hosted, decentralized neighborhood community platform built on [Holochain](https://holochain.org) using the Neighborhoods framework.

## Vision

OurBlock treats a "neighborhood" as a modular unit—not just a social feed, but a toolkit where communities can plug in modules like:

- **The Block Feed** - Chronological updates and local alerts
- **The Tool Shed** - Shared item library (ladders, drills, board games)
- **Helping Hands** - Mutual aid request/offer board
- **Circle Chat** - Private/group messaging

## Security: The Vouch System

OurBlock uses a Web of Trust instead of central admin approval:

1. **Physical Handshake** - New neighbor meets existing neighbor in person
2. **The Scan** - Existing neighbor scans QR code to cryptographically vouch
3. **Network Entry** - New neighbor becomes visible after X vouches (e.g., 2)
4. **Self-Policing** - Vouchers lose reputation if vouchee misbehaves

---

## 🛠️ Development Environment Setup

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

## 📁 Project Structure

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

## 🚀 Running the App Locally

### Step 1: Enter the Development Environment

**On Windows (requires WSL2):**
```powershell
# From PowerShell, enter WSL
wsl

# Navigate to your project (path may vary)
cd /mnt/c/Users/JVanD/Projects/OurBlock

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

## 🔄 Quick Start Script

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

## 🧪 Testing with Multiple Agents

To test features like vouching and chat, you need multiple agents:

```bash
# Terminal 1: First agent on port 8888
hc sandbox generate workdir/our_block.happ --run=8888 -a our_block

# Terminal 2: Second agent on port 8889
hc sandbox generate workdir/our_block.happ --run=8889 -a our_block
```

Then adjust the WebSocket port in the UI (or run two UI instances pointing to different ports).

---

## 🐛 Troubleshooting

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

## 🔧 Development Workflow

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

## 📜 License

[To be determined]

---

## 🤝 Contributing

[To be determined]
