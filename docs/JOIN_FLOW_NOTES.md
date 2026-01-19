# Join Flow Implementation Notes

## Membrane Proof Integration

### Current Challenge

The `@holochain/client` TypeScript library's `installApp` function has an evolving API for membrane proofs. The exact interface varies between Holochain versions (0.3.x vs 0.4.x vs 0.5.x).

### Implementation Approaches

#### Approach 1: CLI-Based Installation (Current Workaround)

Until the TypeScript client API stabilizes, we recommend using the Holochain CLI for installing apps with membrane proofs:

```bash
hc sandbox call-admin --port 4444 install_app '{
  "agent_key": null,
  "installed_app_id": "ourblock-maple-street-2024",
  "membrane_proofs": {
    "our_block": "OURBLOCK_V1:maple-street-2024:1735689600000000:dGVzd..."
  },
  "network_seed": "maple-street-2024"
}'
```

#### Approach 2: Pre-installed App with Runtime Join

**Alternative workflow:**
1. Install the OurBlock app without membrane proof
2. User enters invite code in UI
3. Call a coordinator function `join_neighborhood(invite_code)` at runtime
4. Function validates the code and adds user to the network

This avoids the genesis_self_check membrane proof entirely and uses runtime validation instead.

#### Approach 3: Custom WebSocket Messages

For advanced use cases, send raw WebSocket messages to the admin API:

```typescript
const message = {
  type: 'install_app',
  data: {
    agent_key: null,
    installed_app_id: 'ourblock-network',
    membrane_proofs: {
      our_block: inviteCode,  // Full OURBLOCK_V1 code
    },
    network_seed: networkSeed,
  },
};

adminWs.client.send(JSON.stringify(message));
```

### TypeScript API Evolution

The Holochain client API is evolving. Here's what we know:

**@holochain/client v0.16.x:**
```typescript
interface InstallAppRequest {
  agent_key?: AgentPubKey;
  installed_app_id?: string;
  membrane_proofs?: MembraneProofs;
  network_seed?: string;
  // ... other fields
}
```

**@holochain/client v0.17.x+:**
The API may change. Check the latest docs at:
- https://www.npmjs.com/package/@holochain/client
- https://docs.rs/holochain_conductor_api/

### Recommended Path Forward

For now, the JoinNeighborhood component uses type assertions (`as any`) to work around API inconsistencies. This is a temporary measure.

**Long-term solution:**
1. Monitor @holochain/client releases
2. Update to stable membrane_proofs API when available
3. Remove type assertions
4. Add proper TypeScript types

**Alternative for production:**
Consider the "Pre-installed App" approach (Approach 2) which:
- Avoids genesis_self_check complexity
- Uses runtime validation (more flexible)
- Better error handling (can prompt user to re-enter code)
- Easier to implement revocation (DHT lookup at join time)

## Testing Membrane Proof Validation

Until the UI fully supports membrane proofs, test the validation manually:

```bash
# 1. Generate an invite
hc sandbox call --port 8888 our_block profile generate_invitation '{
  "neighbor_name": "Alice",
  "voucher": null
}'

# 2. Copy the invite_code from output

# 3. Try to install with the code
hc sandbox call-admin --port 4444 install_app '{
  "agent_key": null,
  "installed_app_id": "test-join",
  "membrane_proofs": {
    "our_block": "PASTE_INVITE_CODE_HERE"
  },
  "network_seed": "YOUR_NETWORK_SEED"
}'

# 4. Check if genesis_self_check passed
# If successful, the app will be installed
# If failed, you'll see "InvalidMembraneProof" error
```

## References

- [Holochain Membrane Proofs](https://docs.holochain.org/concepts/3_application_architecture/#membrane-proofs)
- [@holochain/client Docs](https://github.com/holochain/holochain-client-js)
- [genesis_self_check HDK Docs](https://docs.rs/hdk/latest/hdk/prelude/trait.CallbackResult.html#genesis-self-check)

## Questions?

If you're working on improving the membrane proof integration:
1. Check the latest @holochain/client version
2. Review the Rust API in holochain_conductor_api
3. Test with `hc sandbox` CLI first
4. Then update TypeScript accordingly

The Holochain team is actively improving this API. Stay tuned!
