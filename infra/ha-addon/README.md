# OurBlock Hub - Home Assistant Add-on

A Holochain-based neighborhood coordination platform running as a Home Assistant add-on.

## Architecture

This add-on uses S6-overlay to manage multiple processes within a single container:

- **Lair Keystore**: Cryptographic key management for Holochain
- **Holochain Conductor**: Main Holochain runtime
- **Rust Sidecar**: Admin API and business logic
- **Nginx**: HTTPS web server for the UI
- **mDNS**: Local network discovery as `ourblock.local`

## Installation

1. Add this repository to Home Assistant:
   - Settings → Add-ons → Add-on Store → ⋮ → Repositories
   - Add: `https://github.com/Pixel-Pilot28/OurBlock`

2. Install "OurBlock Hub" add-on

3. Configure the add-on:
   - **Neighborhood Name**: Your neighborhood's display name
   - **Admin Password**: (optional) Leave blank to auto-generate
   - **Enable Vouching**: Require member vouching (recommended)
   - **Log Level**: info, debug, trace, warn, or error

4. Start the add-on

## Access

- **Web UI**: https://ourblock.local:4443 (or https://your-ha-ip:4443)
- **Mobile Apps**: ws://ourblock.local:8888
- **Admin Password**: Check add-on logs if auto-generated

## Differences from Docker Compose Deployment

The standard deployment (`/infra/docker-general`) uses Docker Compose to orchestrate multiple containers. This Home Assistant add-on runs all services as processes within a single container using S6-overlay for process supervision.

Both deployments run the same code from `/dnas` and `/ui`.

## Troubleshooting

**Check logs**: Settings → Add-ons → OurBlock Hub → Log

**Restart add-on**: Settings → Add-ons → OurBlock Hub → Restart

**Data location**: `/config` in add-on = `/addon_configs/ab96dad4_ourblock-hub` on host

## Support

GitHub: https://github.com/Pixel-Pilot28/OurBlock
