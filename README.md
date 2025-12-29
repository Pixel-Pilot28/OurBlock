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

### Future Modules (Planned)

- **vouch/** - Web of Trust / Identity DNA
- **block_feed/** - Main feed DNA  
- **tool_shed/** - Shared items library DNA
- **helping_hands/** - Mutual aid DNA
- **circle_chat/** - Messaging DNA

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
