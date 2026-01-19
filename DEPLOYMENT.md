# OurBlock - Holochain Launcher Deployment

## Installation

### For End Users (via Holochain Launcher)

1. **Install Holochain Launcher**
   - Download from [holochain.org](https://holochain.org)
   - Follow the installation instructions for your platform

2. **Install OurBlock**
   - Download the latest `our_block.webhapp` from the releases page
   - Open Holochain Launcher
   - Click "Install new app"
   - Select the `our_block.webhapp` file
   - Follow the setup wizard

3. **Start Using OurBlock**
   - Click on the OurBlock icon in the Launcher
   - The app will open in your default browser
   - Create your profile and start connecting with neighbors!

### For Developers

#### Building the WebHapp

Requirements:
- Nix package manager with Holochain flakes
- Node.js 18+
- Rust toolchain (via Nix)

```bash
# Build the complete webhapp package
nix develop github:holochain/holonix?ref=main-0.6 --command ./package.sh
```

This will:
1. Compile all Rust zomes to WASM
2. Package the DNA
3. Build the UI (React + Vite)
4. Create the .webhapp file for Launcher distribution

Output: `workdir/our_block.webhapp`

#### Development Mode

For development with hot-reload:

```bash
# Terminal 1 - Start Holochain conductor
nix develop github:holochain/holonix?ref=main-0.6
holochain -c conductor-config.yaml

# Terminal 2 - Start UI dev server
cd ui
npm install
npm run dev
```

The UI will connect to your local conductor at `localhost:36449`.

## Connection Modes

OurBlock automatically detects its environment:

- **Launcher Mode**: When running via Holochain Launcher, uses dynamic port assignment
- **Development Mode**: When running locally, connects to hardcoded ports (configurable via .env)

## Environment Variables

For development mode, create `ui/.env`:

```env
VITE_HC_PORT=36449
VITE_HC_ADMIN_PORT=9999
VITE_HC_HOST=localhost
```

## Deployment

### Publishing to App Store

1. Build the webhapp: `./package.sh`
2. Test in Launcher locally
3. Submit to [Holochain App Library](https://github.com/holochain/app-store-dnas)
4. Follow their submission guidelines

### Self-Hosting

Users can install the .webhapp file directly without going through the app store.
Just share the `our_block.webhapp` file with your community.

## Network Seed

The DNA uses a default network seed. To create a private network:

1. Edit `dnas/our_block/workdir/dna.yaml`
2. Set a unique `network_seed` value
3. Rebuild the DNA

Only agents with the same network seed can see each other.
