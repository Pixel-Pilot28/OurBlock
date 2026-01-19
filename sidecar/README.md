# OurBlock Sidecar Management Service

A lightweight HTTP service that runs on the Docker host to manage system-level operations like container updates and restarts.

## Purpose

The OurBlock app runs inside Docker containers and cannot directly control its own Docker environment. This sidecar service bridges that gap by:

- Providing version information from Docker Hub
- Triggering `docker compose pull && docker compose up -d` for updates
- Restarting containers on demand
- Exposing health check endpoints

## Installation

```bash
cd sidecar
npm install
```

## Running the Service

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The service will start on `http://localhost:3001`.

## API Endpoints

### `GET /health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-17T12:00:00.000Z"
}
```

### `GET /version`
Get current version and check for updates.

**Response:**
```json
{
  "version": "0.1.0",
  "latest": "0.1.1",
  "updateAvailable": true
}
```

### `POST /update`
Trigger a Docker Compose update (pull latest images and restart).

**Request Body:**
```json
{
  "version": "0.1.1"
}
```

**Response:**
```json
{
  "status": "updating",
  "message": "Update process started"
}
```

The update runs in the background and executes:
```bash
docker compose pull
docker compose up -d
```

### `POST /restart`
Restart all Docker containers without pulling new images.

**Response:**
```json
{
  "status": "restarting",
  "message": "Restart process started"
}
```

## Configuration

The service expects:
- `docker-compose.yml` in the parent directory (`../docker-compose.yml`)
- `package.json` in the parent directory for version information
- Docker and Docker Compose installed on the host
- Node.js 16+ installed

## Security Considerations

⚠️ **Important**: This service has privileged access to Docker on the host machine.

### Recommendations:
1. **Firewall**: Only allow connections from localhost (`127.0.0.1`)
2. **Authentication**: Add API key authentication for production
3. **HTTPS**: Use reverse proxy with TLS in production
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Logging**: Monitor all update/restart requests

### Production Hardening

For production deployments, consider:

```javascript
// Add API key middleware
const API_KEY = process.env.SIDECAR_API_KEY || 'change-me';

function authenticate(req) {
  const authHeader = req.headers['authorization'];
  return authHeader === `Bearer ${API_KEY}`;
}
```

## Running as System Service

### Linux (systemd)

Create `/etc/systemd/system/ourblock-sidecar.service`:

```ini
[Unit]
Description=OurBlock Sidecar Management Service
After=network.target docker.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/OurBlock/sidecar
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ourblock-sidecar
sudo systemctl start ourblock-sidecar
```

### Windows (NSSM)

Use [NSSM](https://nssm.cc/) to run as Windows service:

```powershell
nssm install OurBlockSidecar "C:\Program Files\nodejs\node.exe"
nssm set OurBlockSidecar AppDirectory "C:\Path\To\OurBlock\sidecar"
nssm set OurBlockSidecar AppParameters "server.js"
nssm start OurBlockSidecar
```

## Logging

The service logs to stdout. Redirect to file if needed:

```bash
npm start > sidecar.log 2>&1
```

Or use a process manager like PM2:

```bash
npm install -g pm2
pm2 start server.js --name ourblock-sidecar
pm2 save
pm2 startup
```

## Troubleshooting

### "docker-compose.yml not found"
- Ensure the service is running from the `sidecar` directory
- Check that `../docker-compose.yml` exists relative to the service

### "docker command not found"
- Ensure Docker is installed and in PATH
- The user running the service must have Docker permissions
- On Linux: Add user to `docker` group

### CORS errors
- The service includes CORS headers for `*` (all origins)
- For production, restrict to specific origins

### Update not working
- Check Docker Compose logs: `docker compose logs -f`
- Verify the service has permissions to run Docker commands
- Check sidecar service console output for errors

## Development

The service uses vanilla Node.js with no external dependencies for maximum portability and security.

To modify behavior:
1. Edit `server.js`
2. Restart the service (or use `npm run dev` for auto-reload)
3. Test endpoints with curl or the OurBlock UI

## License

MIT
