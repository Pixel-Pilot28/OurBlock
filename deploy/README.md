# OurBlock Edge Node Deployment

Deploy OurBlock as a "Neighborhood Anchor" - a 24/7 edge node that holds data for your community even when individual devices are offline.

## ⚡ One-Click Installation

| Platform | Installation Method |
|----------|---------------------|
| **Any Linux** | `curl -fsSL https://ourblock.community/install.sh \| bash` |
| **Raspberry Pi** | `curl -fsSL https://ourblock.community/raspi.sh \| bash` |
| **Docker** | `docker compose up -d` |
| **CasaOS** | See [deploy/casaos/](casaos/) - Import as custom app |
| **Umbrel** | See [deploy/umbrel/](umbrel/) - Community app store |
| **Home Assistant** | See [deploy/homeassistant/](homeassistant/) - Add-on repository |
| **Proxmox** | See [deploy/proxmox/](proxmox/) - LXC container script |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Host                                   │
│  (Raspberry Pi, Mini PC, Proxmox VM)                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│  │   Nginx     │   │    OurBlock     │   │    Lair Keystore    │   │
│  │   (UI)      │◄──│   Conductor     │◄──│    (Crypto Keys)    │   │
│  │  :3000      │   │  :8888 / :8001  │   │      :50000         │   │
│  └─────────────┘   └─────────────────┘   └─────────────────────┘   │
│         │                   │                                        │
│         │                   ▼                                        │
│         │          ┌─────────────────┐                              │
│         │          │  Holochain DHT  │◄────── Peer Nodes            │
│         │          │   (our_block)   │                              │
│         │          └─────────────────┘                              │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Web Browser                              │   │
│  │                  (Neighbor's Device)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### One-Command Setup

```bash
curl -fsSL https://raw.githubusercontent.com/ourblock/ourblock/main/deploy/scripts/setup.sh | bash
```

### Manual Setup

1. **Install Docker** (if not already installed):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

2. **Clone the repository**:
   ```bash
   git clone https://github.com/ourblock/ourblock.git
   cd ourblock
   ```

3. **Configure** (optional):
   ```bash
   cp deploy/.env.example deploy/.env
   nano deploy/.env  # Customize settings
   ```

4. **Start the node**:
   ```bash
   cd deploy
   docker compose up -d
   ```

5. **Access the UI**:
   Open http://localhost:3000 in your browser

## 🍓 Raspberry Pi Deployment

### Requirements
- Raspberry Pi 4 or 5 (4GB+ RAM recommended)
- 32GB+ SD card or SSD
- Raspberry Pi OS (64-bit)

### Steps

1. **Flash Raspberry Pi OS** (64-bit Lite recommended)

2. **Enable SSH and connect**

3. **Install Docker**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker pi
   sudo reboot
   ```

4. **Run OurBlock**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/ourblock/ourblock/main/deploy/scripts/setup.sh | bash
   ```

5. **Access from your network**:
   - Find the Pi's IP: `hostname -I`
   - Open `http://<pi-ip>:3000` from any device

### Performance Tips

- Use an SSD instead of SD card for better performance
- Allocate swap space for memory-intensive operations:
  ```bash
  sudo dphys-swapfile swapoff
  sudo nano /etc/dphys-swapfile  # Set CONF_SWAPSIZE=2048
  sudo dphys-swapfile setup
  sudo dphys-swapfile swapon
  ```

## 🖥️ Proxmox Deployment

### Create a VM

1. Download Ubuntu Server 22.04 LTS ISO
2. Create VM with:
   - 2+ CPU cores
   - 4GB+ RAM
   - 32GB+ disk
3. Install Ubuntu Server
4. Follow the [Manual Setup](#manual-setup) steps

### Create an LXC Container

1. Download the Ubuntu 22.04 template
2. Create container with:
   - 2+ CPU cores
   - 2GB+ RAM
   - 16GB+ disk
   - Nesting enabled (for Docker)
3. Install Docker inside the container
4. Follow the [Manual Setup](#manual-setup) steps

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NETWORK_SEED` | `ourblock-neighborhood-001` | Unique identifier for your network |
| `BOOTSTRAP_URL` | `https://bootstrap.holo.host` | Peer discovery service |
| `SIGNAL_URL` | `wss://signal.holo.host` | WebRTC signaling service |
| `RUST_LOG` | `info` | Log verbosity (error/warn/info/debug/trace) |

### Custom Network

To create an isolated network for your neighborhood:

```bash
# Generate a unique network seed
NETWORK_SEED="ourblock-$(openssl rand -hex 8)"
echo "Your network seed: $NETWORK_SEED"

# Add to .env
echo "NETWORK_SEED=$NETWORK_SEED" >> deploy/.env
```

Share this seed with neighbors who want to join your network.

## 🌐 Running Your Own Bootstrap/Signal Server

For fully offline mesh operation (no internet required after setup):

1. Uncomment the bootstrap and signal services in `docker-compose.yaml`

2. Update environment:
   ```bash
   BOOTSTRAP_URL=http://localhost:8787
   SIGNAL_URL=ws://localhost:8989
   ```

3. Restart:
   ```bash
   docker compose --profile mesh up -d
   ```

## 📊 Monitoring

### View Logs

```bash
# All services
docker compose logs -f

# Just the conductor
docker compose logs -f ourblock

# Just the UI
docker compose logs -f ui
```

### Check Status

```bash
docker compose ps
```

### Resource Usage

```bash
docker stats
```

## 🔄 Updates

```bash
cd ~/ourblock
git pull
cd deploy
docker compose pull
docker compose up -d
```

## 🗑️ Uninstall

```bash
cd ~/ourblock/deploy
docker compose down -v  # -v removes data volumes
cd ~
rm -rf ourblock
```

## 🛠️ Building from Source

### Multi-Architecture Build

```bash
# Build for both amd64 and arm64
./deploy/scripts/build-multiarch.sh

# Build and push to registry
./deploy/scripts/build-multiarch.sh --push
```

### Single Architecture

```bash
cd deploy
docker compose build
```

## 🔐 Security Considerations

1. **Backup your keys**: The `.lair_passphrase` file is critical
   ```bash
   cp ~/ourblock/.lair_passphrase ~/backup/
   ```

2. **Firewall**: Only expose necessary ports
   ```bash
   sudo ufw allow 3000/tcp  # UI only
   # Don't expose 8001 (admin) to the internet
   ```

3. **Updates**: Keep Docker and the image updated

4. **Network isolation**: Use a unique `NETWORK_SEED` for your neighborhood

## 🆘 Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs ourblock

# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :8888
```

### Can't connect from other devices

1. Check firewall: `sudo ufw status`
2. Verify the host IP: `hostname -I`
3. Ensure you're on the same network

### High memory usage

```bash
# Restart the conductor
docker compose restart ourblock

# Check memory usage
docker stats
```

### Data corruption

```bash
# Stop services
docker compose down

# Remove volumes (THIS DELETES ALL DATA)
docker volume rm ourblock_conductor_data

# Restart
docker compose up -d
```

## 📜 License

MIT License - See [LICENSE](../LICENSE) for details.
