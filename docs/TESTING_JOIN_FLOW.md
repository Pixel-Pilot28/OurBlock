# Testing the Join Flow

This guide walks through testing the complete neighborhood join flow.

## Prerequisites

1. **Running OurBlock Hub**
   - Either via Home Assistant Add-on, or
   - Docker Compose: `docker-compose up -d`
   - Holochain conductor should be accessible on ports 4444 (admin) and 8888 (app)

2. **Frontend Development Server**
   ```bash
   cd ui
   npm install
   npm run dev
   ```

## Step 1: Configure Environment

Create or update `ui/.env.local`:

```env
VITE_HC_HOST=localhost
VITE_HC_PORT=8888
VITE_HC_ADMIN_PORT=4444
VITE_BOOTSTRAP_SERVER_URL=https://bootstrap.holochain.org
```

## Step 2: Generate an Invite Code

### Option A: Using Holochain Playground (Temporary)

Until we build the Hub admin UI, you can generate a test invite manually:

```bash
# Connect to Holochain admin websocket
hc sandbox call-admin --port 4444 \
  generate_invitation \
  '{"neighbor_name": "Alice"}'
```

Expected output:
```json
{
  "invite_code": "OURBLOCK_V1:abc123def456:1234567890123456:SGVsbG8gV29ybGQ=",
  "invitation_hash": "uhCkk...",
  "created_at": 1234567890123456,
  "expires_at": 1234567890123456
}
```

### Option B: Mock Invite Code (Development Only)

For frontend testing, you can use a mock invite code. **Note:** This will fail at the membrane proof validation stage, but it tests the UI flow:

```
OURBLOCK_V1:maple-street-2024:1735689600000000:dGVzdC1zaWduYXR1cmUtZm9yLWRldmVsb3BtZW50
```

### Option C: Using the React Component (Future)

Once we build the Hub admin panel:
1. Navigate to `/admin` (when implemented)
2. Click "Generate Invite"
3. Enter neighbor name
4. Copy the generated code

## Step 3: Test the Join Flow

1. **Open the app**
   - Navigate to `http://localhost:5173` (or your Vite dev server URL)
   - You should see the landing page

2. **Navigate to Join**
   - Click "Join with Invite Code" button
   - OR directly navigate to `http://localhost:5173/join`

3. **Enter Invite Code**
   - Paste the invite code from Step 2
   - The UI should show:
     - ✅ Green border = valid format and not expired
     - ❌ Red border = invalid format or expired
     - Technical details when you expand the dropdown

4. **Submit**
   - Click "Join Neighborhood"
   - Watch the progress indicators:
     - "Connecting to Holochain..."
     - "Installing neighborhood app..."
     - "Enabling app..."
     - "Configuring network..."
   - On success: Redirects to main app (`/`)
   - On failure: Shows error message

## Step 4: Verify Installation

### Check Admin Interface

```bash
# List installed apps
hc sandbox call-admin --port 4444 list_apps '{}'
```

You should see your newly installed app with ID like:
```
ourblock-maple-street-2024
```

### Check App Interface

```bash
# Call a zome function to verify connectivity
hc sandbox call --port 8888 \
  our_block profile get_my_profile '{}'
```

## Step 5: Test Network Connectivity

### Verify DHT Connection

From the UI, check that:
1. The app loads without errors
2. You can see the feed (even if empty)
3. No "Connection Error" messages

### Check mDNS Discovery (Local)

```bash
# On Linux/Mac
avahi-browse -r _ourblock._tcp

# On Windows (PowerShell)
Get-NetNeighbor | Where-Object { $_.LinkLayerAddress -ne "00-00-00-00-00-00" }
```

You should see the Hub advertising itself as `ourblock.local`.

### Check Bootstrap Server (Remote)

The conductor should automatically connect to `https://bootstrap.holochain.org` for peer discovery. Check conductor logs:

```bash
docker logs ourblock-holochain-1 | grep bootstrap
```

Expected: Connection attempts to bootstrap server, peer discovery messages.

## Common Issues

### "Cannot connect to admin websocket"

**Problem:** Holochain conductor not running or wrong port.

**Solution:**
```bash
# Check if conductor is running
docker ps | grep holochain

# Check port bindings
docker port ourblock-holochain-1

# Restart conductor
docker-compose restart holochain
```

### "Invalid membrane proof"

**Problem:** Signature verification failed or network seed mismatch.

**Causes:**
1. Using a mock invite code (expected in development)
2. Invite code was generated for a different network seed
3. Invite code has expired (>7 days old)
4. Hub's agent key doesn't match the signing key

**Solution:**
- Generate a new invite code from the actual Hub
- Check that `neighborhood_uid` in DNA properties matches the network seed
- Ensure invite was generated within last 7 days

### "Network seed mismatch"

**Problem:** The DNA's `neighborhood_uid` doesn't match the invite code's network seed.

**Solution:**
```bash
# Check current DNA properties
hc dna show-properties dnas/our_block/workdir/our_block.dna

# Should show:
# neighborhood_uid: "maple-street-2024"  # Or whatever your network seed is
```

Regenerate the DNA with correct properties:
```bash
cd dnas/our_block
hc dna pack workdir
```

### App installs but doesn't appear in UI

**Problem:** Frontend routing or state management issue.

**Solution:**
1. Check browser console for errors
2. Verify `HolochainContext` is properly connected
3. Hard refresh the page (Ctrl+Shift+R)
4. Check that installed app ID matches expected pattern: `ourblock-{networkSeed}`

## Next Steps

Once the join flow works:

1. **Build Hub Admin UI** - Create `/admin` route with:
   - Generate invitation form
   - List all invitations
   - Revoke invitations
   - QR code display

2. **Test Multi-User** - Join from multiple devices:
   - Desktop (web)
   - Laptop (web)
   - Mobile (when implemented)

3. **Test Network Scenarios**:
   - Same WiFi network (mDNS discovery)
   - Different networks (bootstrap server discovery)
   - Offline mode (local data persistence)

4. **Security Testing**:
   - Try expired invite codes
   - Try revoked invite codes
   - Try tampered invite codes (modified signature)

## Debugging Commands

```bash
# View conductor logs
docker logs -f ourblock-holochain-1

# View sidecar logs (if using Rust gateway)
docker logs -f ourblock-sidecar-1

# Check app state
hc sandbox call-admin --port 4444 dump_state '{"cell_id": {...}}'

# Check network peers
hc sandbox call-admin --port 4444 dump_network_stats '{}'

# Check source chain
hc sandbox call-admin --port 4444 dump_full_state '{"cell_id": {...}}'
```

## Resources

- [INVITATION_SYSTEM.md](../docs/INVITATION_SYSTEM.md) - Invite code format and API
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - Overall system design
- [HOME_ASSISTANT_DEPLOYMENT.md](../docs/HOME_ASSISTANT_DEPLOYMENT.md) - Deployment guide
- [Holochain Client Docs](https://docs.rs/holochain_client/) - AdminWebsocket API reference
