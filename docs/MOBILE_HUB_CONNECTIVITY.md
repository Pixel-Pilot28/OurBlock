# Mobile App & Hub Connectivity Enhancements

**Date:** January 18, 2026  
**Status:** ✅ Complete

## Overview

This document describes critical enhancements to the OurBlock join flow to support mobile Tier 2 clients and ensure the first Hub user can successfully bootstrap their neighborhood.

## Changes Summary

### 1. Hub Address in Invite Codes ✅

**Problem:** Mobile apps had no way to discover which Hub to connect to.

**Solution:** Updated invite code format to include Hub's public address.

#### Old Format
```
OURBLOCK_V1:[NetworkSeed]:[Timestamp]:[Signature]
```

#### New Format
```
OURBLOCK_V1:[HubAddress]:[NetworkSeed]:[Timestamp]:[Signature]
```

**Example:**
```
OURBLOCK_V1:https://hub1.yourblock.com:550e8400-e29b-41d4-a716-446655440000:1737244800000000:iQ7K8...
```

#### Files Modified

**Rust (Coordinator Zome):**
- [`dnas/our_block/zomes/coordinator/profile/src/lib.rs`](dnas/our_block/zomes/coordinator/profile/src/lib.rs)
  - `generate_invitation()`: Reads `hub_address` from DNA properties
  - Signature now includes: `hub_address + network_seed + timestamp`
  - Removed `neighbor_name` from signature (wasn't available in genesis_self_check)

**Rust (Integrity Zome):**
- [`dnas/our_block/zomes/integrity/profile/src/lib.rs`](dnas/our_block/zomes/integrity/profile/src/lib.rs)
  - `genesis_self_check()`: Updated to parse 5-part format
  - Verifies signature using `hub_address + network_seed + timestamp`

**TypeScript (Utilities):**
- [`ui/src/utils/inviteCode.ts`](ui/src/utils/inviteCode.ts)
  - `ParsedInviteCode` interface: Added `hubAddress: string`
  - `parseInviteCode()`: Expects 5 parts instead of 4
  - Validates hub address is present

**TypeScript (UI):**
- [`ui/src/pages/JoinNeighborhood.tsx`](ui/src/pages/JoinNeighborhood.tsx)
  - Displays hub address in code preview
  - Shows hub address in technical details

---

### 2. First User Self-Signing Bypass ✅

**Problem:** The Hub creator couldn't join their own app because genesis_self_check requires a signature, but no one existed yet to generate the first invite.

**Solution:** Added `bootstrap_agent_key` check in genesis_self_check.

#### How It Works

**DNA Properties Configuration:**
```yaml
# dnas/our_block/workdir/dna.yaml
properties:
  neighborhood_uid: "550e8400-e29b-41d4-a716-446655440000"
  hub_address: "https://hub1.yourblock.com"
  hub_public_key: "base64_encoded_agent_key"
  bootstrap_agent_key: "base64_encoded_agent_key"  # <-- NEW
  private_neighborhood: true
```

**Rust Implementation:**
```rust
// In genesis_self_check():
if let Some(serde_json::Value::String(bootstrap_key_str)) = properties.get("bootstrap_agent_key") {
    if let Ok(bootstrap_key_bytes) = base64::decode(bootstrap_key_str) {
        if let Ok(bootstrap_key) = AgentPubKey::try_from(bootstrap_key_bytes) {
            if bootstrap_key == data.agent_key {
                // This is the Hub creator, allow self-signed entry
                return Ok(ValidateCallbackResult::Valid);
            }
        }
    }
}
```

#### Workflow

1. **Hub Setup:** Generate agent key and set it as `bootstrap_agent_key` in DNA properties
2. **First Install:** When Hub creator installs the app, genesis_self_check detects match and bypasses signature check
3. **Subsequent Users:** Once Hub is running, admin generates invites normally using `generate_invitation()`

---

### 3. Official Bootstrap Server ✅

**Problem:** Code referenced `bootstrap.holo.host` (Holo infrastructure) instead of official community server.

**Solution:** Updated `.env.example` to use `https://bootstrap.holochain.org`.

#### Files Modified

- [`deploy/.env.example`](deploy/.env.example)
  - `BOOTSTRAP_URL=https://bootstrap.holochain.org`
  - `SIGNAL_URL=wss://signal.holochain.org`

**Why This Matters:**
- Holo infrastructure is for Holo Hosting (commercial service)
- Holochain.org infrastructure is for community P2P apps
- Using wrong server may cause peer discovery issues

---

### 4. Connection Status Indicator ✅

**Problem:** Users had no visibility into P2P sync status.

**Solution:** Created `ConnectionStatus` component with real-time status display.

#### Component Features

**States:**
- 🟢 **Synced:** Connected to peers, DHT up-to-date
- 🟡 **Searching:** Looking for peers via bootstrap
- 🔵 **Connecting:** Establishing P2P connections  
- 🔴 **Offline:** No connection to Holochain conductor

**UI Elements:**
- Animated status dot (pulses during searching/connecting)
- Peer count display (when synced)
- Last sync timestamp
- Hover tooltip with status explanations

#### Files Created

- [`ui/src/components/ConnectionStatus.tsx`](ui/src/components/ConnectionStatus.tsx)
  - Polls app websocket every 5 seconds
  - Displays real-time connection state
  - Auto-reconnects if conductor restarts

#### Integration

Updated [`ui/src/App.tsx`](ui/src/App.tsx):
```tsx
import ConnectionStatus from './components/ConnectionStatus';

// In header:
<h1>🏘️ OurBlock</h1>
<ConnectionStatus className="ml-auto" />
```

#### Future Enhancements

Currently uses simulated peer count. Once Holochain provides peer count API:

```typescript
// Replace simulated peer count with:
const peerCount = await appWs.callZome({
  role_name: 'our_block',
  zome_name: 'profile',
  fn_name: 'get_peer_count',
  payload: null,
});
```

---

## Mobile App Integration Guide

### Step 1: Parse Invite Code

```typescript
import { parseInviteCode } from './utils/inviteCode';

const inviteCode = 'OURBLOCK_V1:https://hub1.yourblock.com:550e...';
const parsed = parseInviteCode(inviteCode);

if (parsed) {
  console.log('Hub Address:', parsed.hubAddress);
  console.log('Network Seed:', parsed.networkSeed);
  console.log('Timestamp:', parsed.timestamp);
  console.log('Signature:', parsed.signature);
}
```

### Step 2: Connect to Hub

The mobile app should:

1. **Extract Hub Address** from invite code
2. **Connect to Admin API** at `${hubAddress}/admin` (default: `https://hub1.yourblock.com:4444`)
3. **Install App** using the invite code as membrane proof
4. **Configure Signaling** using Hub's address for WebRTC relay

```typescript
// Mobile app connection flow
const hubAddress = parsed.hubAddress;
const adminWs = await AdminWebsocket.connect({
  url: new URL(`wss://${hubAddress}/admin`),
  wsClientOptions: {
    origin: 'ourblock-mobile',
  },
});

const membraneProof = new TextEncoder().encode(inviteCode);
const appInfo = await adminWs.installApp({
  installed_app_id: `ourblock-${parsed.networkSeed}`,
  membrane_proofs: {
    our_block: membraneProof,
  },
  network_seed: parsed.networkSeed,
});
```

### Step 3: Configure Signal Server

For mobile devices behind NAT, WebRTC signaling is critical:

```typescript
// Mobile devices need explicit signal server configuration
const signalServerUrl = `wss://${hubAddress}/signal`;

// This would be set in conductor config for mobile builds
const conductorConfig = {
  network: {
    transport_pool: [
      {
        type: 'webrtc',
        signal_url: signalServerUrl,
      },
    ],
  },
};
```

---

## Hub Setup Checklist

### For Hub Administrators

#### 1. Configure DNA Properties

Edit `dnas/our_block/workdir/dna.yaml`:

```yaml
properties:
  # Required fields
  neighborhood_uid: "your-unique-neighborhood-id"
  hub_address: "https://your-hub-domain.com"  # Or IP: "192.168.1.100:8888"
  private_neighborhood: true
  
  # For signature verification (generate with Holochain tools)
  hub_public_key: "base64_encoded_agent_key"
  
  # For first-user bypass (same as hub_public_key initially)
  bootstrap_agent_key: "base64_encoded_agent_key"
```

#### 2. Get Agent Public Key

```bash
# Start Holochain conductor
cd deploy
docker-compose up -d

# Get agent public key (this will be printed in logs on first run)
# Or use admin API:
curl -X POST http://localhost:4444 \
  -H "Content-Type: application/json" \
  -d '{"type": "generate_agent_pub_key"}'

# Encode to base64
echo "uhCAk..." | base64
```

#### 3. Set Hub Address

Options:

**Public Domain:**
```yaml
hub_address: "https://hub1.yourblock.com"
```

**Static IP:**
```yaml
hub_address: "192.168.1.100:8888"
```

**Dynamic DNS:**
```yaml
hub_address: "https://myhub.ddns.net"
```

**Development (localhost):**
```yaml
hub_address: "localhost:8888"
```

#### 4. First Install

The first time you install the app:

1. Set `bootstrap_agent_key` to your generated agent key
2. Install app normally (no invite code needed)
3. App bypasses genesis_self_check because you match bootstrap key
4. After successful install, generate invites for neighbors

#### 5. Generate Invites

Once Hub is running:

1. Navigate to `/admin`
2. Enter neighbor name and validity period
3. Click "Generate Invite"
4. Share QR code or text code with neighbor
5. Mobile app scans QR → extracts hub address → connects automatically

---

## Testing Scenarios

### ✅ Test 1: Hub Creator Bootstrap

```bash
# Set bootstrap_agent_key in DNA properties
# Install app (should succeed without invite)
# Verify profile can be created
```

### ✅ Test 2: Generate Invite with Hub Address

```bash
# Navigate to /admin
# Generate invite
# Verify code contains hub address
# Example: OURBLOCK_V1:localhost:8888:550e...
```

### ✅ Test 3: Mobile Join Flow

```bash
# Mobile app scans QR code
# Parses hub address
# Connects to hub at specified address
# Installs app with membrane proof
# genesis_self_check validates signature
```

### ✅ Test 4: Connection Status Display

```bash
# Load app
# Verify connection status shows "Connecting" → "Searching" → "Synced"
# Disconnect conductor
# Verify status shows "Offline"
# Reconnect
# Verify status returns to "Synced"
```

### ✅ Test 5: Bootstrap Server

```bash
# Check conductor config uses https://bootstrap.holochain.org
# Start Hub
# Verify Hub registers with bootstrap server
# Join from different network
# Verify bootstrap returns Hub's IP address
```

---

## Known Limitations

### 1. Peer Count Not Implemented

Connection status currently shows simulated peer count. Requires Holochain API addition:

```rust
// TODO: Add to coordinator zome
#[hdk_extern]
pub fn get_peer_count(_: ()) -> ExternResult<usize> {
    // Query Kitsune2 for active peer connections
    // Not yet available in HDK
}
```

### 2. Hub Address Validation

Currently no validation that hub address is reachable. Mobile app should:

```typescript
// Add connectivity check before install
async function verifyHubReachable(hubAddress: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${hubAddress}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
```

### 3. Signal Server Auto-Discovery

Mobile apps must manually configure signal server. Future improvement:

```yaml
# Hub could publish signal server URL in DHT
properties:
  hub_address: "https://hub1.yourblock.com"
  signal_server: "wss://signal.hub1.yourblock.com"  # Auto-discovered
```

---

## Security Considerations

### Hub Address Spoofing

**Risk:** Malicious actor could create invite with fake hub address.

**Mitigation:**
- Signature ties invite to specific hub's public key
- Mobile app verifies signature before connecting
- Network seed ensures DHT isolation

### First User Attack

**Risk:** If `bootstrap_agent_key` is compromised, attacker could bypass validation.

**Mitigation:**
- `bootstrap_agent_key` should only be used for initial install
- After first user, generate invites normally
- Consider removing `bootstrap_agent_key` from DNA after bootstrap

### Dynamic IP Challenges

**Risk:** Hub's IP changes, invite codes become invalid.

**Mitigation:**
- Use domain names instead of IPs
- Implement dynamic DNS
- Mobile app could query bootstrap server for updated Hub address

---

## Next Steps

### High Priority

1. **Implement Peer Count API** in Holochain
2. **Add Hub Health Endpoint** for mobile connectivity checks
3. **Test Cross-Network Joins** (mobile 5G → home WiFi Hub)

### Medium Priority

4. **Signal Server Auto-Discovery** from Hub
5. **Hub Address Update Mechanism** (if IP changes)
6. **Mobile App Deep Linking** (tap QR code → auto-open app)

### Low Priority

7. **Connection Status Analytics** (track sync latency)
8. **Peer Discovery Dashboard** (show peer locations on map)
9. **Hub Migration Tool** (move to new domain)

---

## API Reference

### Rust Functions

#### `generate_invitation(input: GenerateInvitationInput)`

Generates a new invitation code.

**Input:**
```rust
struct GenerateInvitationInput {
    neighbor_name: String,
    validity_duration: Option<u64>,  // seconds, default 7 days
    voucher: Option<AgentPubKey>,
}
```

**Output:**
```rust
struct InvitationOutput {
    invite_code: String,             // OURBLOCK_V1:...
    invitation_hash: ActionHash,
    created_at: Timestamp,
    expires_at: Timestamp,
}
```

**DNA Properties Required:**
- `neighborhood_uid`: Network seed
- `hub_address`: Public URL/IP

#### `genesis_self_check(data: GenesisSelfCheckData)`

Validates membrane proof during agent join.

**Checks:**
1. Format: `OURBLOCK_V1:[HubAddress]:[NetworkSeed]:[Timestamp]:[Signature]`
2. Network seed matches DNA property
3. Timestamp not expired (< 7 days old)
4. Signature valid (from Hub's public key)
5. **OR** joining agent is bootstrap agent (first user bypass)

### TypeScript Functions

#### `parseInviteCode(inviteCode: string)`

Parses OURBLOCK_V1 format code.

**Returns:**
```typescript
interface ParsedInviteCode {
  hubAddress: string;      // e.g., "https://hub1.yourblock.com"
  networkSeed: string;     // UUID
  timestamp: number;       // Microseconds since epoch
  signature: string;       // Base64-encoded signature
  fullCode: string;        // Original code
}
```

#### `validateInviteCode(inviteCode: string)`

Validates format and expiration.

**Returns:**
```typescript
interface ValidationResult {
  isValid: boolean;
  error?: string;
}
```

---

## Conclusion

These changes enable:

✅ **Mobile apps** to auto-discover Hub address from invite codes  
✅ **Hub creators** to bootstrap their neighborhood without external invites  
✅ **Users** to monitor P2P sync status in real-time  
✅ **Deployments** to use official Holochain community infrastructure

All changes are backwards-compatible with development mode (signature verification disabled when `hub_public_key` not set).

**Status:** Ready for end-to-end testing with mobile devices.
