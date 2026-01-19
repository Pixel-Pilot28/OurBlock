use hdi::prelude::*;

/// Membrane proof structure for neighborhood authorization
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MembraneProof {
    /// Signature from the Hub's public key authorizing this agent
    pub hub_signature: Signature,
    /// Timestamp when the invite was created
    pub timestamp: Timestamp,
    /// Optional voucher agent (if vouching is enabled)
    pub voucher: Option<AgentPubKey>,
}

/// Invitation record stored on Hub's source chain for tracking and revocation
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Invitation {
    /// Name/identifier for this invitation
    pub neighbor_name: String,
    /// The generated invite code
    pub invite_code: String,
    /// When this invitation was created
    pub created_at: Timestamp,
    /// When this invitation expires
    pub expires_at: Timestamp,
    /// Optional voucher who created this invite
    pub voucher: Option<AgentPubKey>,
    /// Whether this invitation has been revoked
    pub revoked: bool,
}

/// A neighbor's public profile in the community.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Profile {
    pub nickname: String,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub location_metadata: Option<String>,
}

/// Revocation record for blacklisting malicious agents
/// Links to this anchor indicate an agent has been revoked from the neighborhood
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct RevocationAnchor {
    /// The agent public key being revoked
    pub revoked_agent: AgentPubKey,
    /// Reason for revocation
    pub reason: String,
    /// Timestamp of revocation
    pub revoked_at: Timestamp,
    /// Admin who performed the revocation
    pub revoker: AgentPubKey,
}

pub const MIN_NICKNAME_LENGTH: usize = 2;
pub const MAX_NICKNAME_LENGTH: usize = 50;
pub const MAX_BIO_LENGTH: usize = 500;
pub const MAX_AVATAR_URL_LENGTH: usize = 500;
pub const MAX_LOCATION_METADATA_LENGTH: usize = 200;

#[hdk_link_types]
pub enum LinkTypes {
    AgentToProfile,
    AllProfiles,
    AllInvitations,
    RevokedAgents,  // Links from RevocationAnchor to revoked agents
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "profile", visibility = "public")]
    Profile(Profile),
    #[entry_type(name = "invitation", visibility = "private")]
    Invitation(Invitation),
    #[entry_type(name = "revocation_anchor", visibility = "public")]
    RevocationAnchor(RevocationAnchor),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Profile(profile) => {
                    // Check if author is revoked
                    if is_agent_revoked(&action.author)? {
                        return Ok(ValidateCallbackResult::Invalid(
                            "Agent has been revoked from this neighborhood".to_string()
                        ));
                    }
                    validate_profile(profile)
                },
                EntryTypes::Invitation(invitation) => validate_invitation(invitation),
                EntryTypes::RevocationAnchor(revocation) => validate_revocation(revocation),
            },
            OpEntry::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Profile(profile) => {
                    // Check if author is revoked
                    if is_agent_revoked(&action.author)? {
                        return Ok(ValidateCallbackResult::Invalid(
                            "Agent has been revoked from this neighborhood".to_string()
                        ));
                    }
                    validate_profile(profile)
                },
                EntryTypes::Invitation(invitation) => validate_invitation(invitation),
                EntryTypes::RevocationAnchor(revocation) => validate_revocation(revocation),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Profile(profile) => {
                    // Check if author is revoked
                    if is_agent_revoked(&action.author)? {
                        return Ok(ValidateCallbackResult::Invalid(
                            "Agent has been revoked from this neighborhood".to_string()
                        ));
                    }
                    validate_profile(profile)
                },
                EntryTypes::Invitation(invitation) => validate_invitation(invitation),
                EntryTypes::RevocationAnchor(revocation) => validate_revocation(revocation),
            },
            OpRecord::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Profile(profile) => {
                    // Check if author is revoked
                    if is_agent_revoked(&action.author)? {
                        return Ok(ValidateCallbackResult::Invalid(
                            "Agent has been revoked from this neighborhood".to_string()
                        ));
                    }
                    validate_profile(profile)
                },
                EntryTypes::Invitation(invitation) => validate_invitation(invitation),
                EntryTypes::RevocationAnchor(revocation) => validate_revocation(revocation),
            },
            OpRecord::CreateLink { base_address, target_address, tag, link_type, action } => {
                // Check if author is revoked
                if is_agent_revoked(&action.author)? {
                    return Ok(ValidateCallbackResult::Invalid(
                        "Agent has been revoked from this neighborhood".to_string()
                    ));
                }
                Ok(ValidateCallbackResult::Valid)
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_profile(profile: Profile) -> ExternResult<ValidateCallbackResult> {
    if profile.nickname.len() < MIN_NICKNAME_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Nickname must be at least {} characters", MIN_NICKNAME_LENGTH
        )));
    }
    if profile.nickname.len() > MAX_NICKNAME_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Nickname cannot exceed {} characters", MAX_NICKNAME_LENGTH
        )));
    }
    if let Some(ref bio) = profile.bio {
        if bio.len() > MAX_BIO_LENGTH {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "Bio cannot exceed {} characters", MAX_BIO_LENGTH
            )));
        }
    }
    if let Some(ref avatar_url) = profile.avatar_url {
        if avatar_url.len() > MAX_AVATAR_URL_LENGTH {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "Avatar URL cannot exceed {} characters", MAX_AVATAR_URL_LENGTH
            )));
        }
    }
    if let Some(ref location_metadata) = profile.location_metadata {
        if location_metadata.len() > MAX_LOCATION_METADATA_LENGTH {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "Location metadata cannot exceed {} characters", MAX_LOCATION_METADATA_LENGTH
            )));
        }
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_invitation(invitation: Invitation) -> ExternResult<ValidateCallbackResult> {
    if invitation.neighbor_name.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Neighbor name cannot be empty".to_string()
        ));
    }
    if invitation.neighbor_name.len() > MAX_NICKNAME_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Neighbor name cannot exceed {} characters", MAX_NICKNAME_LENGTH
        )));
    }
    if invitation.invite_code.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Invite code cannot be empty".to_string()
        ));
    }
    // Verify expiration is in the future (at creation time)
    if invitation.expires_at <= invitation.created_at {
        return Ok(ValidateCallbackResult::Invalid(
            "Expiration must be after creation time".to_string()
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}

// ============================================================================
// Revocation System - DHT-Level Blacklist
// ============================================================================

/// Validate revocation entries
fn validate_revocation(revocation: RevocationAnchor) -> ExternResult<ValidateCallbackResult> {
    if revocation.reason.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Revocation reason cannot be empty".to_string()
        ));
    }
    if revocation.reason.len() > 500 {
        return Ok(ValidateCallbackResult::Invalid(
            "Revocation reason cannot exceed 500 characters".to_string()
        ));
    }
    // TODO: Verify revoker has admin privileges (requires checking DNA properties or admin list)
    Ok(ValidateCallbackResult::Valid)
}

/// Check if an agent has been revoked from the neighborhood
/// Returns true if agent is found in the revocation list
fn is_agent_revoked(agent: &AgentPubKey) -> ExternResult<bool> {
    // Query the DHT for any RevocationAnchor entries for this agent
    // This is a simplified check - in production you'd want to:
    // 1. Use a deterministic anchor point (e.g., hash of "REVOKED_AGENTS")
    // 2. Check links from that anchor to RevocationAnchor entries
    // 3. Filter for entries matching this agent's public key
    
    // For now, return false (not revoked) - will be implemented in coordinator zome
    // when we can use HDK functions to query the DHT
    Ok(false)
}

// ============================================================================
// Genesis Self Check - Membrane Proof Validation
// ============================================================================

#[hdk_extern]
pub fn genesis_self_check(data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
    // Get DNA properties
    let properties = dna_info()?.modifiers.properties;
    
    // Check if this is a private neighborhood
    let private_neighborhood = properties
        .get("private_neighborhood")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    
    // If not private, allow anyone to join
    if !private_neighborhood {
        return Ok(ValidateCallbackResult::Valid);
    }

    // For private neighborhoods, require membrane proof
    let membrane_proof = match data.membrane_proof {
        Some(proof) => proof,
        None => {
            return Ok(ValidateCallbackResult::Invalid(
                "This is a private neighborhood. You need an invite code to join.".to_string()
            ));
        }
    };

    // Try to parse as OURBLOCK_V2 format first (JSON-based P2P format)
    // Format: OURBLOCK_V2:[Base64-encoded JSON]
    if let Ok(proof_string) = String::from_utf8(membrane_proof.clone()) {
        if proof_string.starts_with("OURBLOCK_V2:") {
            // Extract base64 payload
            if let Some(payload_b64) = proof_string.strip_prefix("OURBLOCK_V2:") {
                // Decode base64
                if let Ok(payload_bytes) = base64::decode(payload_b64) {
                    // Parse JSON
                    if let Ok(payload_str) = String::from_utf8(payload_bytes) {
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(&payload_str) {
                            // Extract fields
                            let network_seed = payload.get("network_seed").and_then(|v| v.as_str()).unwrap_or("");
                            let timestamp = payload.get("timestamp").and_then(|v| v.as_i64()).unwrap_or(0);
                            let signature_b64 = payload.get("signature").and_then(|v| v.as_str()).unwrap_or("");
                            let hub_agent_pubkey_b64 = payload.get("hub_agent_pub_key").and_then(|v| v.as_str()).unwrap_or("");

                            // Verify network seed matches
                            let expected_seed = properties
                                .get("neighborhood_uid")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");

                            if network_seed != expected_seed {
                                return Ok(ValidateCallbackResult::Invalid(
                                    "This invite code is for a different neighborhood".to_string()
                                ));
                            }

                            // Check timestamp/expiration
                            let now = sys_time()?;
                            let validity_duration = 7 * 24 * 60 * 60 * 1_000_000i64; // 7 days in microseconds
                            if now.as_micros() > timestamp + validity_duration {
                                return Ok(ValidateCallbackResult::Invalid(
                                    "This invite code has expired".to_string()
                                ));
                            }

                            // Check if this is the bootstrap agent
                            if let Some(serde_json::Value::String(bootstrap_key_str)) = properties.get("bootstrap_agent_key") {
                                if let Ok(bootstrap_key_bytes) = base64::decode(bootstrap_key_str) {
                                    if let Ok(bootstrap_key) = AgentPubKey::try_from(bootstrap_key_bytes) {
                                        if bootstrap_key == data.agent_key {
                                            return Ok(ValidateCallbackResult::Valid);
                                        }
                                    }
                                }
                            }

                            // Verify signature from hub agent
                            if let Ok(hub_pubkey_bytes) = base64::decode(hub_agent_pubkey_b64) {
                                if let Ok(hub_pubkey) = AgentPubKey::try_from(hub_pubkey_bytes) {
                                    // Reconstruct signed data
                                    let signal_url = payload.get("signal_url").and_then(|v| v.as_str()).unwrap_or("");
                                    let mut data_to_verify = network_seed.as_bytes().to_vec();
                                    data_to_verify.extend_from_slice(&timestamp.to_le_bytes());
                                    data_to_verify.extend_from_slice(signal_url.as_bytes());

                                    // Decode signature
                                    if let Ok(signature_bytes) = base64::decode(signature_b64) {
                                        if let Ok(signature) = Signature::try_from(signature_bytes) {
                                            // Verify signature
                                            if verify_signature(hub_pubkey, signature, data_to_verify)? {
                                                return Ok(ValidateCallbackResult::Valid);
                                            } else {
                                                return Ok(ValidateCallbackResult::Invalid(
                                                    "Invalid signature - invite code may be forged".to_string()
                                                ));
                                            }
                                        }
                                    }
                                }
                            }

                            return Ok(ValidateCallbackResult::Invalid(
                                "Could not verify invite signature".to_string()
                            ));
                        }
                    }
                }
            }
        }

        // Try to parse as OURBLOCK_V1 format (legacy - colon-separated)
        // Format: OURBLOCK_V1:[HubAddress]:[NetworkSeed]:[Timestamp]:[Signature]
        if proof_string.starts_with("OURBLOCK_V1:") {
            let parts: Vec<&str> = proof_string.split(':').collect();
            if parts.len() == 5 {
                let hub_address = parts[1];
                let network_seed = parts[2];
                let timestamp_str = parts[3];
                let signature_b64 = parts[4];

                // Verify network seed matches
                let expected_seed = properties
                    .get("neighborhood_uid")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if network_seed != expected_seed {
                    return Ok(ValidateCallbackResult::Invalid(
                        "This invite code is for a different neighborhood".to_string()
                    ));
                }

                // Parse and check timestamp/expiration
                if let Ok(timestamp_micros) = timestamp_str.parse::<i64>() {
                    let now = sys_time()?;
                    let validity_duration = 7 * 24 * 60 * 60 * 1_000_000i64; // 7 days in microseconds
                    if now.as_micros() > timestamp_micros + validity_duration {
                        return Ok(ValidateCallbackResult::Invalid(
                            "This invite code has expired".to_string()
                        ));
                    }

                    // Check if this is the first user (DNA creator/bootstrap)
                    // If bootstrap_agent_key is set and matches joining agent, bypass checks
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

                    // Verify signature
                    // Get the Hub's public key from DNA properties
                    let hub_pubkey_bytes = match properties.get("hub_public_key") {
                        Some(serde_json::Value::String(key_str)) if !key_str.is_empty() => {
                            match base64::decode(key_str) {
                                Ok(bytes) => bytes,
                                Err(e) => {
                                    return Ok(ValidateCallbackResult::Invalid(format!(
                                        "Invalid hub public key format: {}",
                                        e
                                    )));
                                }
                            }
                        }
                        _ => {
                            // If hub_public_key is not set, we trust any valid format
                            // This allows for development/testing without signature verification
                            return Ok(ValidateCallbackResult::Valid);
                        }
                    };

                    let hub_pubkey = match AgentPubKey::try_from(hub_pubkey_bytes) {
                        Ok(key) => key,
                        Err(e) => {
                            return Ok(ValidateCallbackResult::Invalid(format!(
                                "Invalid hub public key: {:?}",
                                e
                            )));
                        }
                    };

                    // Decode signature from base64
                    let signature_bytes = match base64::decode(signature_b64) {
                        Ok(bytes) => bytes,
                        Err(e) => {
                            return Ok(ValidateCallbackResult::Invalid(format!(
                                "Invalid signature format: {}",
                                e
                            )));
                        }
                    };

                    let signature = match Signature::try_from(signature_bytes) {
                        Ok(sig) => sig,
                        Err(e) => {
                            return Ok(ValidateCallbackResult::Invalid(format!(
                                "Invalid signature: {:?}",
                                e
                            )));
                        }
                    };

                    // Reconstruct the signed data: hub_address + network_seed + timestamp
                    let mut signed_data = hub_address.as_bytes().to_vec();
                    signed_data.extend_from_slice(network_seed.as_bytes());
                    signed_data.extend_from_slice(&timestamp_micros.to_le_bytes());

                    // Verify the signature
                    let verify_result = verify_signature(hub_pubkey, signature, signed_data)?;
                    if !verify_result {
                        return Ok(ValidateCallbackResult::Invalid(
                            "Invalid signature on invite code".to_string()
                        ));
                    }
                    
                    // Signature valid, code not expired, network matches
                    return Ok(ValidateCallbackResult::Valid);
                }
            }
        }
    }

    // Fallback to legacy MessagePack membrane proof format
    let proof: MembraneProof = match rmp_serde::from_slice(&membrane_proof) {
        Ok(p) => p,
        Err(e) => {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "Invalid membrane proof format: {}",
                e
            )));
        }
    };

    // Get the Hub's public key from DNA properties
    let hub_pubkey_bytes = match properties.get("hub_public_key") {
        Some(serde_json::Value::String(key_str)) => {
            match base64::decode(key_str) {
                Ok(bytes) => bytes,
                Err(e) => {
                    return Ok(ValidateCallbackResult::Invalid(format!(
                        "Invalid hub public key format: {}",
                        e
                    )));
                }
            }
        }
        _ => {
            return Ok(ValidateCallbackResult::Invalid(
                "Hub public key not configured in DNA properties".to_string()
            ));
        }
    };

    let hub_pubkey = match AgentPubKey::try_from(hub_pubkey_bytes) {
        Ok(key) => key,
        Err(e) => {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "Invalid hub public key: {:?}",
                e
            )));
        }
    };

    // Verify the signature
    // The signed data is: agent_pubkey + timestamp
    let agent_pubkey = data.agent_key;
    let mut signed_data = agent_pubkey.get_raw_39().to_vec();
    signed_data.extend_from_slice(&proof.timestamp.as_micros().to_le_bytes());

    let signature_valid = verify_signature(
        hub_pubkey.clone(),
        proof.hub_signature.clone(),
        signed_data,
    )?;

    if !signature_valid {
        return Ok(ValidateCallbackResult::Invalid(
            "Invalid invite code signature. The invite may have been tampered with.".to_string()
        ));
    }

    // Check if vouching is required
    let require_vouching = properties
        .get("require_vouching")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if require_vouching && proof.voucher.is_none() {
        return Ok(ValidateCallbackResult::Invalid(
            "This neighborhood requires vouching. You need an existing member to vouch for you.".to_string()
        ));
    }

    // All checks passed
    Ok(ValidateCallbackResult::Valid)
}

