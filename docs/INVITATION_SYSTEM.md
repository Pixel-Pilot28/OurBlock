# OurBlock Invitation System

## Overview

OurBlock uses a cryptographic invitation system to control access to private neighborhoods. The Hub generates invite codes that are validated during the Holochain genesis process.

## Invite Code Format

### OURBLOCK_V1 Format (Current)

```
OURBLOCK_V1:[NetworkSeed]:[Timestamp]:[Signature]
```

**Example:**
```
OURBLOCK_V1:550e8400-e29b-41d4-a716-446655440000:1705536000000000:dGhpc19pc19hX3NpZ25hdHVyZQ==
```

**Components:**

1. **Prefix**: `OURBLOCK_V1` - Version identifier
2. **NetworkSeed**: UUID identifying the neighborhood (from DNA properties)
3. **Timestamp**: Unix timestamp in microseconds when invite was created
4. **Signature**: Base64-encoded signature from Hub's private key

### Signature Creation

The Hub signs the following data:
```
network_seed + neighbor_name + timestamp
```

This creates a **reusable code** - one invite code can be shared with multiple neighbors, making distribution easier while maintaining security.

## Invitation Tracking

### Hub's Source Chain

Every invitation is stored as an entry on the Hub's source chain:

```rust
struct Invitation {
    neighbor_name: String,      // Identifier for this invitation
    invite_code: String,         // The generated code
    created_at: Timestamp,       // When created
    expires_at: Timestamp,       // When it expires (default: 7 days)
    voucher: Option<AgentPubKey>,// Who vouched (if any)
    revoked: bool,               // Revocation flag
}
```

### Benefits

1. **Audit Trail**: Hub admin can see all invitations ever created
2. **Revocation**: Mark an invitation as revoked to prevent future use
3. **Accountability**: Track who invited whom (if neighbor names are meaningful)
4. **Analytics**: See invitation patterns, expired codes, etc.

## API Functions

### 1. Generate Invitation (Hub Admin)

```rust
#[hdk_extern]
pub fn generate_invitation(input: GenerateInvitationInput) -> ExternResult<InvitationOutput>
```

**Input:**
```rust
struct GenerateInvitationInput {
    neighbor_name: String,              // E.g., "John Smith" or "Invitation #42"
    voucher: Option<AgentPubKey>,       // Optional voucher
    validity_duration: Option<u64>,     // Seconds (default: 7 days)
}
```

**Output:**
```rust
struct InvitationOutput {
    invite_code: String,          // OURBLOCK_V1:...
    invitation_hash: ActionHash,  // For revocation
    created_at: Timestamp,
    expires_at: Timestamp,
}
```

**Example:**
```typescript
// In the Hub admin UI
const result = await callZome({
  zome_name: "profile",
  fn_name: "generate_invitation",
  payload: {
    neighbor_name: "Sarah from 123 Main St",
    voucher: null,
    validity_duration: null // Use default (7 days)
  }
});

// Share this code with Sarah
console.log(result.invite_code);
// OURBLOCK_V1:550e8400-e29b-41d4-a716-446655440000:1705536000000000:dGhpc19pc19hX3NpZ25hdHVyZQ==
```

### 2. Revoke Invitation

```rust
#[hdk_extern]
pub fn revoke_invitation(invitation_hash: ActionHash) -> ExternResult<()>
```

**Example:**
```typescript
await callZome({
  zome_name: "profile",
  fn_name: "revoke_invitation",
  payload: invitationHash
});
```

**Effect**: Marks the invitation as revoked. Future attempts to use the code will fail validation (not yet implemented in genesis_self_check).

### 3. List All Invitations

```rust
#[hdk_extern]
pub fn list_invitations(_: ()) -> ExternResult<Vec<(Invitation, ActionHash)>>
```

**Example:**
```typescript
const invitations = await callZome({
  zome_name: "profile",
  fn_name: "list_invitations",
  payload: null
});

// Display in admin UI
invitations.forEach(([inv, hash]) => {
  console.log(`${inv.neighbor_name}: ${inv.invite_code}`);
  console.log(`Created: ${inv.created_at}, Expires: ${inv.expires_at}`);
  console.log(`Revoked: ${inv.revoked}`);
});
```

### 4. Validate Invitation Code

```rust
#[hdk_extern]
pub fn validate_invitation_code(invite_code: String) -> ExternResult<bool>
```

**Example:**
```typescript
const isValid = await callZome({
  zome_name: "profile",
  fn_name: "validate_invitation_code",
  payload: "OURBLOCK_V1:..."
});

if (!isValid) {
  alert("This invite code is invalid or expired");
}
```

## Validation Flow

### When a Neighbor Joins

```
┌─────────────────────────────────────────────────────┐
│ 1. Neighbor enters invite code in app              │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. App includes code as membrane_proof             │
│    (passed to Holochain conductor)                  │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. genesis_self_check() callback runs               │
│    (in profile integrity zome)                      │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 4. Parse OURBLOCK_V1 format                         │
│    - Extract network_seed, timestamp, signature     │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 5. Validate network_seed matches DNA property      │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 6. Check expiration (timestamp + 7 days)           │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 7. Accept or reject agent                          │
└─────────────────────────────────────────────────────┘
```

## Security Considerations

### Reusable Codes

**Benefit**: Easy to distribute (print on flyers, post on bulletin board, share via text)

**Risk**: If leaked outside neighborhood, unauthorized users could join

**Mitigation**:
1. **Expiration**: Codes expire after 7 days (configurable)
2. **Revocation**: Hub admin can revoke codes
3. **Vouching**: Optionally require existing members to vouch
4. **Tracking**: All uses are tracked on the DHT (agent's source chain)

### Hub Compromise

**Risk**: If Hub's private key is compromised, attacker can generate valid codes

**Mitigation**:
1. **Hub Security**: Keep Hub on trusted hardware (Home Assistant, Raspberry Pi at home)
2. **Key Rotation**: Periodically generate new Hub keys and DNA
3. **Multi-Hub**: Run 2-3 Hubs per neighborhood (different keys)
4. **Social Layer**: Vouching adds human verification

### Code Sharing

**Best Practices**:
- Share codes via secure channels (Signal, in-person, encrypted email)
- Don't post public codes on social media
- Use short-lived codes (1-2 days) for specific invitations
- Use general codes (7 days) for broader recruitment

## UI Integration

### Admin Panel (Hub)

**Generate Invitation Page:**
```
┌──────────────────────────────────────────┐
│ Generate Neighborhood Invitation         │
├──────────────────────────────────────────┤
│ Neighbor Name: [____________]            │
│ Voucher:       [Select...      ▼]        │
│ Valid For:     [7 days         ▼]        │
│                                           │
│ [Generate Invite Code]                   │
└──────────────────────────────────────────┘

After generation:
┌──────────────────────────────────────────┐
│ Invitation Created!                      │
├──────────────────────────────────────────┤
│ OURBLOCK_V1:550e8400-e29b-41d4-a716-...  │
│                                           │
│ [Copy Code] [Generate QR Code]           │
│                                           │
│ Valid until: Jan 25, 2026 3:00 PM        │
└──────────────────────────────────────────┘
```

**Invitation List Page:**
```
┌──────────────────────────────────────────┐
│ All Invitations                          │
├──────────────────────────────────────────┤
│ Sarah (123 Main St)                      │
│ Created: Jan 18, 2026                    │
│ Expires: Jan 25, 2026                    │
│ Status: Active        [Revoke]           │
├──────────────────────────────────────────┤
│ Bob (Apartment 4B)                       │
│ Created: Jan 15, 2026                    │
│ Expires: Jan 22, 2026                    │
│ Status: Expired                          │
├──────────────────────────────────────────┤
│ General Invite #1                        │
│ Created: Jan 10, 2026                    │
│ Expires: Jan 17, 2026                    │
│ Status: Revoked                          │
└──────────────────────────────────────────┘
```

### Mobile App (Neighbor)

**Join Neighborhood Screen:**
```
┌──────────────────────────────────────────┐
│ Join a Neighborhood                      │
├──────────────────────────────────────────┤
│ Enter your invite code:                  │
│                                           │
│ OURBLOCK_V1:550e8400-e29b-41d4-...       │
│                                           │
│ [Scan QR Code]                           │
│                                           │
│ [Join Neighborhood]                      │
└──────────────────────────────────────────┘
```

## Future Enhancements

### 1. Single-Use Codes

Modify signature to include agent public key:
```rust
sign(network_seed + neighbor_pubkey + timestamp)
```

**Benefit**: Code only works for specific agent
**Trade-off**: Requires knowing agent's public key before generating code

### 2. Usage Tracking

Add to Invitation entry:
```rust
struct Invitation {
    // ...existing fields...
    used_by: Vec<AgentPubKey>,  // Track who used this code
    max_uses: Option<u32>,       // Limit number of uses
}
```

### 3. Invite Templates

Pre-create invitation templates with different expiration and voucher settings:
- "Quick Invite" (24 hours, no voucher required)
- "Vouched Invite" (7 days, voucher required)
- "Permanent Invite" (1 year, for trusted recruiters)

### 4. QR Code Generation

Generate QR codes directly in the Hub admin UI:
```typescript
const qrCode = generateQRCode(invitationOutput.invite_code);
// Display or print QR code for scanning
```

## Testing

### Manual Testing

```bash
# In Holochain Try-o-rama or Playground

# 1. Generate invitation
let result = await alice_hub.callZome({
  zome_name: "profile",
  fn_name: "generate_invitation",
  payload: {
    neighbor_name: "Test Neighbor",
    voucher: null,
    validity_duration: 60 * 60 * 24 * 7 // 7 days in seconds
  }
});

console.log("Invite Code:", result.invite_code);

# 2. Try to join with the code
let bob_conductor = await createConductor();
await bob_conductor.installDna({
  // ...DNA config...
  membrane_proof: result.invite_code
});

# Should succeed if code is valid
```

### Automated Tests

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_generate_invitation() {
        // Hub generates invitation
        let result = generate_invitation(...);
        assert!(result.invite_code.starts_with("OURBLOCK_V1:"));
    }

    #[test]
    fn test_expired_invitation() {
        // Create invitation with 0 second validity
        // Try to use it
        // Should fail with "expired" error
    }

    #[test]
    fn test_wrong_neighborhood() {
        // Generate invitation for neighborhood A
        // Try to use it in neighborhood B
        // Should fail with "wrong neighborhood" error
    }
}
```

## Summary

The OurBlock invitation system provides:

✅ **Cryptographic Security** - Signatures prevent forgery
✅ **Tracking & Revocation** - Hub maintains invitation log
✅ **Expiration** - Codes auto-expire after 7 days
✅ **Reusability** - One code for multiple neighbors (optional)
✅ **Simplicity** - Easy to share via text, QR code, or in-person
✅ **Backwards Compatibility** - Supports legacy MessagePack format

**Next Steps**: Build UI for invitation management in the Hub admin panel and mobile app join flow.
