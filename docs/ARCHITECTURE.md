# OurBlock Architecture: Hybrid P2P Model

## Overview

OurBlock uses a **Hybrid Peer-to-Peer (P2P)** architecture where the network consists of:

1. **OurBlock Hub** (Tier 1) - 24/7 "Super-Peer" seed node
2. **User Apps** (Tier 2) - Mobile and web clients with sovereign identity

This architecture balances **decentralization** (peer sovereignty) with **accessibility** (easy onboarding for non-technical users).

## Tier 1: OurBlock Hub (The Super-Peer)

### Purpose
The Hub is a **seed node** that provides 24/7 data availability and bridges web users to the Holochain network without requiring them to run their own conductor.

### Responsibilities

#### 1. Full Holochain Node
- Runs a complete Holochain conductor
- Participates in DHT gossip 24/7
- Stores and validates source chains
- Acts as a **persistent peer** for neighborhood data

#### 2. Web-Bridge (Holo Hosting Pattern)
- Serves the React UI to any browser on the local network
- Acts as a **Proxy Conductor** for web-only users
- Handles conductor calls on behalf of browser clients
- Stores source chains for web users (they don't "own" their keys)

#### 3. Mobile Gateway
- Provides WebSocket endpoint for mobile apps
- Mobile users connect to Hub but **retain their own keys**
- Hub helps with DHT operations but doesn't control identity

#### 4. Discovery Service
- Announces itself via mDNS as `ourblock.local`
- Enables zero-config discovery for neighbors
- Supports global discovery via invite codes

### Deployment Options

#### Home Assistant Add-on (Recommended)
- One-click install from Home Assistant UI
- Auto-updates and backups
- Web UI embedded in Home Assistant dashboard
- Perfect for smart home enthusiasts

```yaml
# Configuration in HA UI
neighborhood_name: "Maple Street"
admin_password: "auto-generated-secure-key"
enable_vouching: true
```

#### Raspberry Pi Image
- Pre-configured SD card image
- Flash and boot - no configuration needed
- Ideal for dedicated neighborhood server

#### Docker Compose (Power Users)
- Full control over deployment
- Suitable for Proxmox, NUC, or cloud hosting
- Current development setup

### Hardware Requirements

| Device | Users | Performance |
|--------|-------|------------|
| Raspberry Pi 3 | 5-10 | Minimum |
| Raspberry Pi 4/5 (2GB+) | 20-50 | Recommended |
| Intel NUC / Proxmox | 100+ | Optimal |

### Network Architecture

```
┌─────────────────────────────────────────┐
│         OurBlock Hub (Super-Peer)       │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐│
│  │ Socket   │→ │  Rust    │→ │ Nginx ││
│  │ Proxy    │  │ Sidecar  │  │ HTTPS ││
│  └──────────┘  └──────────┘  └───────┘│
│        ↓             ↓           ↓     │
│  ┌──────────────────────────────────┐ │
│  │   Holochain Conductor (v0.6)     │ │
│  │   - Profile, Feed, Events, Chat  │ │
│  │   - DHT Participation            │ │
│  │   - Source Chain Storage         │ │
│  └──────────────────────────────────┘ │
└─────────────────────────────────────────┘
         ↓ mDNS (ourblock.local)
         ↓ HTTPS (Web UI - Port 443)
         ↓ WebSocket (Mobile - Port 8888)
┌─────────────────────────────────────────┐
│           Local Network                 │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌─────┐│
│  │ Web  │  │Mobile│  │Mobile│  │Web  ││
│  │User A│  │User B│  │User C│  │User││
│  └──────┘  └──────┘  └──────┘  └─────┘│
│    (Hub     (Own      (Own      (Hub   │
│    Keys)    Keys)     Keys)     Keys)  │
└─────────────────────────────────────────┘
```

## Tier 2: User Apps (Mobile & Web)

### Identity Model: **Peer-Sovereign**

#### Mobile Users (Sovereign)
- **Generate their own Agent Keypair** locally
- Connect to Hub via WebSocket
- Hub stores their source chain but **doesn't own** their identity
- Can switch between Hubs without losing identity
- True peer-to-peer participant

#### Web Users (Hub-Proxied)
- Access Hub via browser at `https://ourblock.local`
- Hub generates keypair **on their behalf**
- Convenient but **less sovereign** (Hub owns keys)
- Suitable for less technical neighbors
- Can "graduate" to mobile app to regain sovereignty

### Authentication Flow

#### Join by Invite Code

```
┌──────────────────────────────────────────────────────┐
│ 1. Hub Admin Creates Invite                          │
│    - Generates "OB-V1-A7F3E2..."                     │
│    - Encodes: Neighborhood UID + Hub Signature       │
│    - Optionally includes Voucher (existing member)   │
└──────────────────────────────────────────────────────┘
                    ↓ Share code
┌──────────────────────────────────────────────────────┐
│ 2. New User Enters Code                              │
│    - Mobile app parses code                          │
│    - Extracts Network Seed + Membrane Proof          │
│    - Generates own Agent Keypair locally             │
└──────────────────────────────────────────────────────┘
                    ↓ Connect to Hub
┌──────────────────────────────────────────────────────┐
│ 3. genesis_self_check Validates Proof                │
│    - Verifies Hub's signature on invite              │
│    - Checks voucher (if required)                    │
│    - Accepts or rejects agent                        │
└──────────────────────────────────────────────────────┘
                    ↓ Accepted
┌──────────────────────────────────────────────────────┐
│ 4. User Joins Neighborhood DHT                       │
│    - Hub stores source chain                         │
│    - User can interact with neighborhood             │
│    - Can switch Hubs, identity persists              │
└──────────────────────────────────────────────────────┘
```

### Invite Code Structure

```
OB-V1-<BASE64_PAYLOAD>

Where PAYLOAD contains (MessagePack encoded):
{
  "network_seed": "uuid-for-neighborhood",
  "hub_signature": "signature of (agent_pubkey + timestamp)",
  "timestamp": 1706472000000000,
  "voucher": "optional-voucher-agent-pubkey",
  "neighborhood_name": "Maple Street"
}
```

## Security Model

### Three Layers of Defense

1. **Socket Proxy** - Filters Docker API (only ALLOW_RESTARTS=1)
2. **Rust Sidecar** - API key authentication + rate limiting
3. **Nginx Reverse Proxy** - HTTPS termination + localhost binding

### Membrane Proof Validation

The `genesis_self_check` callback in the profile integrity zome validates:

```rust
pub fn genesis_self_check(data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
    // 1. Check if neighborhood is private
    let private = dna_properties.private_neighborhood;
    
    // 2. Require membrane_proof if private
    let proof = data.membrane_proof.ok_or("Need invite code")?;
    
    // 3. Verify Hub's signature
    let hub_pubkey = dna_properties.hub_public_key;
    verify_signature(hub_pubkey, proof.hub_signature, agent_data)?;
    
    // 4. Check vouching (if enabled)
    if dna_properties.require_vouching && proof.voucher.is_none() {
        return Invalid("Need voucher");
    }
    
    // 5. Accept agent
    Ok(Valid)
}
```

### DNA Properties

Configured in `dna.yaml`:

```yaml
properties:
  private_neighborhood: true
  require_vouching: true
  hub_public_key: "base64-encoded-hub-pubkey"
  neighborhood_uid: "uuid-v4"
  neighborhood_name: "Maple Street"
```

## Decentralization vs. Convenience

### Why Not Pure P2P?

**Pure P2P** (every user runs own conductor):
- ✅ Maximum sovereignty
- ❌ Requires installation
- ❌ Must stay online to participate
- ❌ High barrier for non-technical users

**OurBlock Hybrid** (Hub + User Apps):
- ✅ One technical neighbor can host for everyone
- ✅ Mobile users retain sovereignty (own keys)
- ✅ Web users get convenience (Hub-proxied)
- ✅ 24/7 data availability (Hub always online)
- ⚠️ Hub is a "honey pot" (if compromised, neighborhood data exposed)

### Risk Mitigation

1. **Multiple Hubs** - Encourage 2-3 Hubs per neighborhood
2. **Encrypted Backups** - Hub backs up encrypted data only
3. **Key Rotation** - Mobile users can switch Hubs anytime
4. **Vouching** - Prevents sybil attacks (fake accounts)

## Deployment Workflow

### For Neighborhood Admins (Hub Setup)

1. **Install Home Assistant Add-on**
   ```
   Settings → Add-ons → Add Repository → Install OurBlock Hub
   ```

2. **Configure Neighborhood**
   ```yaml
   neighborhood_name: "My Neighborhood"
   enable_vouching: true
   ```

3. **Start Hub**
   - Generates Hub keypair
   - Creates DNA with properties
   - Announces via mDNS

4. **Create Invite Codes**
   - Visit `https://ourblock.local/admin`
   - Click "Create Invite"
   - Share code with neighbors

### For Neighbors (Joining)

#### Mobile App Users
1. Download OurBlock from App Store / Play Store
2. Tap "Join Neighborhood"
3. Enter invite code: `OB-V1-A7F3E2...`
4. App generates keys locally
5. Connects to Hub
6. Start participating!

#### Web Users
1. Visit `https://ourblock.local` (on same network)
2. Enter invite code
3. Hub generates keys on their behalf
4. Start participating!

## Future Enhancements

### Global Discovery (Beyond Local Network)

Instead of mDNS, use **Invite Codes** that encode:
- Hub's IP or Tailscale hostname
- Holochain bootstrap servers
- Network seed for neighborhood

This enables joining from anywhere, not just local network.

### Progressive Sovereignty

Allow web users to "graduate" to mobile app:
1. Export keys from Hub
2. Import into mobile app
3. Now sovereign (Hub no longer controls keys)

### Multi-Hub Neighborhoods

Run 2-3 Hubs per neighborhood for redundancy:
- All Hubs participate in same DHT
- If one fails, others continue
- No single point of failure

## References

- **Holo Hosting Pattern**: https://developer.holochain.org/concepts/holo-hosting/
- **Membrane Proofs**: https://developer.holochain.org/concepts/membranes/
- **DHT Gossip**: https://developer.holochain.org/concepts/dht/
- **Home Assistant Add-ons**: https://developers.home-assistant.io/docs/add-ons

---

**Architecture Status**: ✅ Implemented (Tasks 1-6 Complete)

**Next Steps**:
- Test membrane proof validation
- Build mobile app (React Native)
- Create invite code generator UI
- Publish Home Assistant add-on
