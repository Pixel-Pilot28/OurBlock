# V2 Invite Codes - Domain-less P2P Discovery

## Overview

OurBlock v0.5.0 introduces V2 invite codes to enable **domain-less** connectivity. This allows neighbors to join without requiring:
- Static IP addresses
- Domain names
- Port forwarding
- VPNs or tunnels

## Comparison: V1 vs V2

### V1 Invite Codes (Legacy - Domain-Based)

**Format:**
```
OURBLOCK_V1:[HubAddress]:[NetworkSeed]:[Timestamp]:[Signature]
```

**Example:**
```
OURBLOCK_V1:192.168.1.100:5000:abc123network:1234567890:base64signature==
```

**Requirements:**
- Hub must have a static IP or domain
- Clients connect directly to hub's HTTP endpoint
- Hub address hardcoded in invite

**Signed Data:**
```
hub_address + network_seed + timestamp
```

---

### V2 Invite Codes (New - P2P-Based)

**Format:**
```
OURBLOCK_V2:[Base64-encoded JSON]
```

**JSON Payload:**
```json
{
  "network_seed": "abc123network",
  "hub_agent_pub_key": "uhCAk...[base64 agent key]",
  "signal_url": "wss://signal.holochain.org",
  "bootstrap_url": "https://bootstrap.holochain.org",
  "timestamp": 1234567890,
  "signature": "base64signature=="
}
```

**Example:**
```
OURBLOCK_V2:eyJuZXR3b3JrX3NlZWQiOiJhYmMxMjNuZXR3b3JrIiwiaHViX2FnZW50X3B1Yl9rZXkiOiJ1aENBay4uLiIsInNpZ25hbF91cmwiOiJ3c3M6Ly9zaWduYWwuaG9sb2NoYWluLm9yZyIsImJvb3RzdHJhcF91cmwiOiJodHRwczovL2Jvb3RzdHJhcC5ob2xvY2hhaW4ub3JnIiwidGltZXN0YW1wIjoxMjM0NTY3ODkwLCJzaWduYXR1cmUiOiJiYXNlNjRzaWduYXR1cmU9PSJ9
```

**Requirements:**
- Hub only needs Holochain installation
- Clients discover hub via **agent public key**
- Holochain's signal servers provide P2P relay
- No static networking configuration needed

**Signed Data:**
```
network_seed + timestamp + signal_url
```

---

## How V2 Works

### 1. Hub Generates Invite

When a hub admin creates an invite code:

```rust
// Extract hub's agent public key
let hub_agent_pubkey = agent_info()?.agent_initial_pubkey;

// Create JSON payload with P2P discovery info
let invite_payload = json!({
    "network_seed": "abc123network",
    "hub_agent_pub_key": base64::encode(hub_agent_pubkey),
    "signal_url": "wss://signal.holochain.org",
    "bootstrap_url": "https://bootstrap.holochain.org",
    "timestamp": current_timestamp,
    "signature": signature_of_data
});

// Encode as base64 for safe transport
let invite_code = format!("OURBLOCK_V2:{}", base64::encode(json_string));
```

### 2. Neighbor Joins via P2P

When a neighbor uses the invite code:

```typescript
// Parse V2 code
const parsed = parseInviteCode(code);
// parsed.hubAgentPubKey - Hub's agent key for discovery
// parsed.signalUrl - Signal server for P2P relay
// parsed.bootstrapUrl - Bootstrap for network discovery

// Install app with membrane proof
await appWebsocket.installApp({
  installed_app_id: `ourblock-${parsed.networkSeed}`,
  network_seed: parsed.networkSeed,
  membrane_proofs: { our_block: code_as_bytes }
});

// Holochain's conductor automatically:
// 1. Extracts hub_agent_pub_key from membrane proof
// 2. Connects to signal_url
// 3. Discovers hub agent via signal server
// 4. Establishes direct P2P connection (WebRTC/QUIC)
// 5. No HTTP connection to hub needed!
```

### 3. Signature Verification

During `genesis_self_check`, the network validates:

```rust
// Decode V2 invite
let payload = decode_base64_json(invite_code)?;

// Reconstruct signed data
let mut data = network_seed.as_bytes().to_vec();
data.extend_from_slice(&timestamp.to_le_bytes());
data.extend_from_slice(signal_url.as_bytes());

// Verify signature from hub's agent key
verify_signature(hub_agent_pubkey, signature, data)?;

// Verify network seed matches
// Verify timestamp not expired
// Verify signature is valid
```

---

## Benefits of V2

### For Hub Admins
- ✅ No static IP needed
- ✅ No port forwarding
- ✅ No domain registration
- ✅ No tunnel/VPN setup
- ✅ Works behind NAT
- ✅ Works on mobile data

### For Neighbors
- ✅ Single code works anywhere
- ✅ Automatic P2P discovery
- ✅ Faster connection (no HTTP polling)
- ✅ More reliable (Holochain signal infrastructure)

### For Developers
- ✅ Leverages Holochain's proven P2P stack
- ✅ No custom signaling server needed
- ✅ Built-in NAT traversal
- ✅ Resilient to network changes

---

## Backwards Compatibility

Both V1 and V2 codes are supported:

### Frontend Parsing
```typescript
export function parseInviteCode(code: string): ParsedInviteCode | null {
  // Try V2 first (JSON-based)
  if (code.startsWith('OURBLOCK_V2:')) {
    return parseV2Code(code);
  }
  
  // Fall back to V1 (colon-separated)
  if (code.startsWith('OURBLOCK_V1:')) {
    return parseV1Code(code);
  }
  
  return null;
}
```

### Backend Validation
```rust
// In genesis_self_check():
if proof_string.starts_with("OURBLOCK_V2:") {
    validate_v2_proof(proof_string)?;
} else if proof_string.starts_with("OURBLOCK_V1:") {
    validate_v1_proof(proof_string)?;
} else {
    return Err("Invalid invite format");
}
```

---

## Configuration

### Conductor Setup

The conductor must be configured for Kitsune2 networking:

```yaml
# deploy/config/conductor-config.yaml
network:
  network_type: kitsune2_network
  bootstrap_service: ${BOOTSTRAP_URL}
  transport_pool:
    - type: webrtc
      signal_url: ${SIGNAL_URL}
```

### Environment Variables

```bash
# Use Holochain's public infrastructure
SIGNAL_URL="wss://signal.holochain.org"
BOOTSTRAP_URL="https://bootstrap.holochain.org"

# Or use custom servers for private networks
SIGNAL_URL="wss://signal.myorg.com"
BOOTSTRAP_URL="https://bootstrap.myorg.com"
```

---

## Security Considerations

### V2 Signature Verification

V2 codes sign different data than V1:

**V1 Signs:**
```
hub_address + network_seed + timestamp
```

**V2 Signs:**
```
network_seed + timestamp + signal_url
```

This ensures:
- Signal URL cannot be tampered with
- Network seed is cryptographically bound
- Timestamp prevents replay attacks
- Hub's agent key is verified

### Expiration

Both V1 and V2 codes can have expiration times:

```rust
const INVITE_VALIDITY_DAYS: u64 = 7;

if timestamp_age > INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1_000_000 {
    return Err("Invite code expired");
}
```

---

## Testing

### Manual Testing

**Generate V2 Code:**
1. Start hub conductor
2. Navigate to Admin page
3. Create invite with default validity
4. Code will be V2 format with public signal servers

**Join via V2 Code:**
1. Open JoinNeighborhood page
2. Paste V2 code
3. UI shows "Domain-less P2P Discovery"
4. Install completes without HTTP connection to hub

**Verify P2P Connection:**
1. Check conductor logs for WebRTC connections
2. Verify no HTTP errors
3. Confirm neighborhood data syncs

### Automated Testing

```typescript
// ui/src/utils/inviteCode.test.ts
describe('V2 Invite Codes', () => {
  it('parses V2 JSON format', () => {
    const code = 'OURBLOCK_V2:' + btoa(JSON.stringify({
      network_seed: 'test123',
      hub_agent_pub_key: 'uhCAk...',
      signal_url: 'wss://signal.holochain.org',
      bootstrap_url: 'https://bootstrap.holochain.org',
      timestamp: Date.now(),
      signature: 'sig123'
    }));
    
    const parsed = parseInviteCode(code);
    expect(parsed?.version).toBe('V2');
    expect(parsed?.networkSeed).toBe('test123');
  });
});
```

---

## Migration Guide

### For Existing Hubs

V1 codes will continue to work. To start using V2:

1. ✅ Update conductor config with signal/bootstrap URLs
2. ✅ Restart conductor
3. ✅ New invites automatically use V2 format
4. ✅ Old V1 codes remain valid

### For Developers

Update invite handling:

```typescript
// OLD (V1 only):
const hubAddress = parsed.hubAddress;
const url = `http://${hubAddress}/api/...`;

// NEW (V1/V2 compatible):
if (parsed.version === 'V2') {
  // P2P discovery - no HTTP needed
  // Conductor handles everything
} else {
  // Legacy V1 HTTP connection
  const hubAddress = (parsed as ParsedInviteCodeV1).hubAddress;
  const url = `http://${hubAddress}/api/...`;
}
```

---

## Troubleshooting

### "Could not connect to signal server"

Check that `SIGNAL_URL` is accessible:
```bash
curl -v wss://signal.holochain.org
```

### "P2P discovery failed"

1. Verify conductor network config
2. Check firewall allows WebRTC (UDP ports)
3. Verify bootstrap server is reachable
4. Check conductor logs for connection attempts

### "V2 code rejected"

1. Verify timestamp not expired
2. Check signature matches hub's agent key
3. Ensure network_seed matches conductor config
4. Verify signal_url is trusted

---

## Future Enhancements

### Custom Signal Servers

Organizations can run private signal infrastructure:

```bash
# Private network with custom servers
SIGNAL_URL="wss://signal.ourblock.local"
BOOTSTRAP_URL="https://bootstrap.ourblock.local"
```

### Hybrid Mode

Support simultaneous V1 (HTTP) and V2 (P2P) connections for redundancy.

### Multi-Hub Federation

Use V2 for hub-to-hub connections, enabling larger distributed networks.

---

## References

- [Holochain Kitsune2 Networking](https://github.com/holochain/holochain/blob/develop/crates/kitsune2/)
- [WebRTC Signaling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)
- [OurBlock Architecture](./ARCHITECTURE.md)
