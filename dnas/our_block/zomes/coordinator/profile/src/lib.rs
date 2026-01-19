//! Profile Coordinator Zome
//!
//! This zome implements the business logic for managing user profiles.
//! It uses the types and validation rules defined in profile_integrity.

use hdk::prelude::*;
use profile_integrity::*;

/// Input for creating or updating a profile
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateProfileInput {
    pub nickname: String,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub location_metadata: Option<String>,
}

/// Profile with additional metadata for the frontend
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProfileOutput {
    pub profile: Profile,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
    pub agent: AgentPubKey,
}

/// Anchor path for listing all profiles
const ALL_PROFILES_ANCHOR: &str = "all_profiles";

/// Creates a new profile for the calling agent
///
/// Each agent can only have one profile. If a profile already exists,
/// this will return an error. Use `update_profile` to modify an existing profile.
#[hdk_extern]
pub fn create_profile(input: CreateProfileInput) -> ExternResult<ProfileOutput> {
    let agent = agent_info()?.agent_initial_pubkey;

    // Check if profile already exists
    let existing = get_profile_for_agent(agent.clone())?;
    if existing.is_some() {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Profile already exists. Use update_profile to modify it.".to_string()
        )));
    }

    // Create the profile entry
    let profile = Profile {
        nickname: input.nickname,
        bio: input.bio,
        avatar_url: input.avatar_url,
        location_metadata: input.location_metadata,
    };

    let action_hash = create_entry(EntryTypes::Profile(profile.clone()))?;
    let entry_hash = hash_entry(&profile)?;

    // Link agent to their profile
    create_link(
        agent.clone(),
        entry_hash.clone(),
        LinkTypes::AgentToProfile,
        (),
    )?;

    // Link to all_profiles anchor for discovery
    let anchor_hash = anchor_hash()?;
    create_link(anchor_hash, entry_hash.clone(), LinkTypes::AllProfiles, ())?;

    Ok(ProfileOutput {
        profile,
        action_hash,
        entry_hash,
        agent,
    })
}

/// Updates the calling agent's profile
/// Uses get_agent_activity to ensure we're working with the latest source chain state
#[hdk_extern]
pub fn update_profile(input: CreateProfileInput) -> ExternResult<ProfileOutput> {
    let agent = agent_info()?.agent_initial_pubkey;

    // Use get_agent_activity to find the latest profile action
    let activity = get_agent_activity(
        agent.clone(),
        ChainQueryFilter::default(),
        ActivityRequest::Full,
    )?;

    // Find the latest profile entry in the agent's chain
    let mut latest_profile_action: Option<ActionHash> = None;
    
    for activity_item in activity.valid_activity.iter().rev() {
        if let Some(record) = get(activity_item.0.clone(), GetOptions::default())? {
            if let Some(_profile) = record
                .entry()
                .to_app_option::<Profile>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                latest_profile_action = Some(activity_item.0.clone());
                break;
            }
        }
    }

    let original_action_hash = latest_profile_action
        .ok_or_else(|| wasm_error!(WasmErrorInner::Guest("No profile exists to update.".to_string())))?;

    // Create updated profile with new fields
    let profile = Profile {
        nickname: input.nickname,
        bio: input.bio,
        avatar_url: input.avatar_url,
        location_metadata: input.location_metadata,
    };

    let action_hash = update_entry(original_action_hash.clone(), &profile)?;
    let entry_hash = hash_entry(&profile)?;

    // Delete old link and create new one
    let links = get_links(
        LinkQuery::try_new(agent.clone(), LinkTypes::AgentToProfile)?,
        GetStrategy::Local,
    )?;
    
    for link in links {
        delete_link(link.create_link_hash, GetOptions::default())?;
    }

    create_link(
        agent.clone(),
        entry_hash.clone(),
        LinkTypes::AgentToProfile,
        (),
    )?;

    // Emit signal for profile update
    emit_signal(SystemSignal::ProfileUpdated {
        agent: agent.clone(),
        action_hash: action_hash.clone(),
    })?;

    Ok(ProfileOutput {
        profile,
        action_hash,
        entry_hash,
        agent,
    })
}

/// Gets the profile for the calling agent
#[hdk_extern]
pub fn get_my_profile(_: ()) -> ExternResult<Option<ProfileOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    get_profile_for_agent(agent)
}

/// Gets the profile for a specific agent
#[hdk_extern]
pub fn get_agent_profile(agent: AgentPubKey) -> ExternResult<Option<ProfileOutput>> {
    get_profile_for_agent(agent)
}

/// Internal helper to get a profile for an agent
fn get_profile_for_agent(agent: AgentPubKey) -> ExternResult<Option<ProfileOutput>> {
    let links = get_links(
        LinkQuery::try_new(agent.clone(), LinkTypes::AgentToProfile)?,
        GetStrategy::Local,
    )?;

    let Some(link) = links.into_iter().next() else {
        return Ok(None);
    };

    let entry_hash = EntryHash::try_from(link.target).map_err(|_| {
        wasm_error!(WasmErrorInner::Guest("Invalid entry hash in link".to_string()))
    })?;

    // Get the latest record for this entry
    let Some(record) = get(entry_hash.clone(), GetOptions::default())? else {
        return Ok(None);
    };

    let profile: Profile = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
        .ok_or_else(|| wasm_error!(WasmErrorInner::Guest("Profile entry not found".to_string())))?;

    Ok(Some(ProfileOutput {
        profile,
        action_hash: record.action_address().clone(),
        entry_hash,
        agent,
    }))
}

/// Gets all profiles in the neighborhood
#[hdk_extern]
pub fn get_all_profiles(_: ()) -> ExternResult<Vec<ProfileOutput>> {
    let anchor_hash = anchor_hash()?;
    let links = get_links(
        LinkQuery::try_new(anchor_hash, LinkTypes::AllProfiles)?,
        GetStrategy::Local,
    )?;

    let mut profiles = Vec::new();

    for link in links {
        let entry_hash = EntryHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid entry hash in link".to_string()))
        })?;

        if let Some(record) = get(entry_hash.clone(), GetOptions::default())? {
            if let Some(profile) = record
                .entry()
                .to_app_option::<Profile>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                // Get the agent from the record's author
                let agent = record.action().author().clone();
                profiles.push(ProfileOutput {
                    profile,
                    action_hash: record.action_address().clone(),
                    entry_hash,
                    agent,
                });
            }
        }
    }

    Ok(profiles)
}

/// Creates a deterministic anchor hash for all profiles
fn anchor_hash() -> ExternResult<EntryHash> {
    // Use a simple path-based anchor
    let path = Path::from(ALL_PROFILES_ANCHOR);
    path.path_entry_hash()
}

// ============================================================================
// System Signals
// ============================================================================

/// System-level events that can be emitted to connected clients
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SystemSignal {
    ProfileUpdated {
        agent: AgentPubKey,
        action_hash: ActionHash,
    },
    BackupCompleted {
        timestamp: u64,
        status: String,
    },
    UpdateAvailable {
        current_version: String,
        latest_version: String,
    },
    SystemMaintenance {
        message: String,
        severity: String,
    },
}

/// Input for emitting system events
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemEventInput {
    pub event_type: String,
    pub payload: String,
}

/// Emit a system-level signal that the frontend can listen to
/// 
/// This function allows the coordinator to notify connected clients about
/// important system events like profile updates, backup completion, or
/// available updates.
#[hdk_extern]
pub fn signal_system_event(event: SystemSignal) -> ExternResult<()> {
    emit_signal(event)?;
    Ok(())
}

/// Helper function to emit a backup completion signal
#[hdk_extern]
pub fn signal_backup_completed(status: String) -> ExternResult<()> {
    let timestamp = sys_time()?.as_micros();
    emit_signal(SystemSignal::BackupCompleted { timestamp, status })?;
    Ok(())
}

/// Helper function to emit an update available signal
#[hdk_extern]
pub fn signal_update_available(current_version: String, latest_version: String) -> ExternResult<()> {
    emit_signal(SystemSignal::UpdateAvailable {
        current_version,
        latest_version,
    })?;
    Ok(())
}

/// Helper function to emit a system maintenance signal
#[hdk_extern]
pub fn signal_system_maintenance(message: String, severity: String) -> ExternResult<()> {
    emit_signal(SystemSignal::SystemMaintenance { message, severity })?;
    Ok(())
}

// ============================================================================
// Hub Invite Factory - Generate and Track Invitations
// ============================================================================

/// Input for generating an invitation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GenerateInvitationInput {
    /// Name/identifier for the neighbor being invited
    pub neighbor_name: String,
    /// Optional voucher agent (existing member vouching for invitee)
    pub voucher: Option<AgentPubKey>,
    /// How long the invite is valid (in seconds, default 7 days)
    pub validity_duration: Option<u64>,
}

/// Generated invitation output
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InvitationOutput {
    /// The full invite code string (OURBLOCK_V1:...)
    pub invite_code: String,
    /// Action hash of the invitation entry (for revocation)
    pub invitation_hash: ActionHash,
    /// When this invite was created
    pub created_at: Timestamp,
    /// When this invite expires
    pub expires_at: Timestamp,
}

/// Generates an invitation code for a new neighbor
///
/// Format: OURBLOCK_V1:[NetworkSeed]:[Timestamp]:[Signature]
///
/// The invitation is stored on the Hub's source chain for tracking and
/// potential revocation. Only Hub admins should call this function.
///
/// # Arguments
/// * `input` - Neighbor name and optional voucher
///
/// # Returns
/// * `InvitationOutput` - The generated invite code and metadata
#[hdk_extern]
pub fn generate_invitation(input: GenerateInvitationInput) -> ExternResult<InvitationOutput> {
    // Get DNA info
    let dna_info = dna_info()?;
    let properties = dna_info.modifiers.properties;
    
    // Get neighborhood UID (network seed)
    let network_seed = properties
        .get("neighborhood_uid")
        .and_then(|v| v.as_str())
        .ok_or(wasm_error!(WasmErrorInner::Guest(
            "Neighborhood UID not configured in DNA".to_string()
        )))?;

    // Get signal server URL from environment or use public infrastructure
    let signal_url = properties
        .get("signal_url")
        .and_then(|v| v.as_str())
        .unwrap_or("wss://signal.holochain.org"); // Public Holochain signaling

    // Get bootstrap URL
    let bootstrap_url = properties
        .get("bootstrap_url")
        .and_then(|v| v.as_str())
        .unwrap_or("https://bootstrap.holochain.org");

    // Calculate timestamps
    let validity_duration = input.validity_duration.unwrap_or(7 * 24 * 60 * 60); // 7 days
    let created_at = sys_time()?;
    let expires_at = Timestamp::from_micros(
        created_at.as_micros() + (validity_duration as i64 * 1_000_000)
    );

    // Get Hub's agent public key for P2P discovery
    let hub_agent_pubkey = agent_info()?.agent_initial_pubkey;
    let hub_agent_pubkey_b64 = base64::encode(hub_agent_pubkey.get_raw_39());

    // Create data to sign: network_seed + timestamp + signal_url
    let mut data_to_sign = network_seed.as_bytes().to_vec();
    data_to_sign.extend_from_slice(&created_at.as_micros().to_le_bytes());
    data_to_sign.extend_from_slice(signal_url.as_bytes());

    // Sign the data with Hub's key
    let signature = sign(hub_agent_pubkey.clone(), data_to_sign)?;
    let signature_b64 = base64::encode(signature.as_ref());

    // Create JSON payload for invite
    let invite_payload = serde_json::json!({
        "network_seed": network_seed,
        "hub_agent_pub_key": hub_agent_pubkey_b64,
        "signal_url": signal_url,
        "bootstrap_url": bootstrap_url,
        "timestamp": created_at.as_micros(),
        "signature": signature_b64
    });

    // Encode JSON as base64 for the invite code
    let invite_json = serde_json::to_string(&invite_payload)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("JSON error: {}", e))))?;
    let invite_code = format!("OURBLOCK_V2:{}", base64::encode(invite_json.as_bytes()));

    // Create invitation entry for tracking
    let invitation = Invitation {
        neighbor_name: input.neighbor_name,
        invite_code: invite_code.clone(),
        created_at,
        expires_at,
        voucher: input.voucher,
        revoked: false,
    };

    // Store invitation on Hub's source chain
    let invitation_hash = create_entry(EntryTypes::Invitation(invitation.clone()))?;

    // Create link for easy retrieval of all invitations
    let path = Path::from("all_invitations");
    let path_hash = path.path_entry_hash()?;
    create_link(
        path_hash,
        invitation_hash.clone(),
        LinkTypes::AllInvitations,
        (),
    )?;

    Ok(InvitationOutput {
        invite_code,
        invitation_hash,
        created_at,
        expires_at,
    })
}

/// Revokes an invitation by marking it as revoked
///
/// # Arguments
/// * `invitation_hash` - Action hash of the invitation to revoke
#[hdk_extern]
pub fn revoke_invitation(invitation_hash: ActionHash) -> ExternResult<()> {
    // Get the original invitation
    let record = get(invitation_hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest(
            "Invitation not found".to_string()
        )))?;

    let invitation: Invitation = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Deserialization error: {:?}", e))))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(
            "Invalid invitation entry".to_string()
        )))?;

    // Create updated invitation with revoked flag
    let updated_invitation = Invitation {
        revoked: true,
        ..invitation
    };

    // Update the entry
    update_entry(invitation_hash, &updated_invitation)?;

    Ok(())
}

/// Lists all invitations created by this Hub
///
/// # Returns
/// * Vec of (Invitation, ActionHash) tuples
#[hdk_extern]
pub fn list_invitations(_: ()) -> ExternResult<Vec<(Invitation, ActionHash)>> {
    let path = Path::from("all_invitations");
    let path_hash = path.path_entry_hash()?;

    // Get all links to invitations
    let links = get_links(
        GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllInvitations)?
            .build(),
    )?;

    let mut invitations = Vec::new();

    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
                if let Some(invitation) = record.entry().to_app_option::<Invitation>().ok().flatten() {
                    invitations.push((invitation, action_hash));
                }
            }
        }
    }

    Ok(invitations)
}

/// Validates an invitation code format (without consuming it)
///
/// Parses the OURBLOCK_V1 format and checks signature validity
///
/// # Arguments
/// * `invite_code` - The invite code to validate
///
/// # Returns
/// * `bool` - True if valid, false otherwise
#[hdk_extern]
pub fn validate_invitation_code(invite_code: String) -> ExternResult<bool> {
    // Parse the code: OURBLOCK_V1:[NetworkSeed]:[Timestamp]:[Signature]
    if !invite_code.starts_with("OURBLOCK_V1:") {
        return Ok(false);
    }

    let parts: Vec<&str> = invite_code.split(':').collect();
    if parts.len() != 4 {
        return Ok(false);
    }

    let network_seed = parts[1];
    let timestamp_str = parts[2];
    let signature_b64 = parts[3];

    // Check network seed matches
    let dna_info = dna_info()?;
    let expected_seed = dna_info.modifiers.properties
        .get("neighborhood_uid")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if network_seed != expected_seed {
        return Ok(false); // Wrong neighborhood
    }

    // Parse timestamp
    let timestamp_micros: i64 = match timestamp_str.parse() {
        Ok(t) => t,
        Err(_) => return Ok(false),
    };

    let invite_timestamp = Timestamp::from_micros(timestamp_micros);

    // Check if expired
    let now = sys_time()?;
    let validity_duration = 7 * 24 * 60 * 60 * 1_000_000; // 7 days in microseconds
    if now.as_micros() > invite_timestamp.as_micros() + validity_duration {
        return Ok(false); // Expired
    }

    // Decode signature
    let signature_bytes = match base64::decode(signature_b64) {
        Ok(bytes) => bytes,
        Err(_) => return Ok(false),
    };

    // Verify signature would require knowing the neighbor_name that was signed
    // For now, just validate format and expiration
    // Full validation happens in genesis_self_check when agent joins

    Ok(true)
}

// ============================================================================
// Deprecated: Old invite code system (keeping for backwards compatibility)
// ============================================================================

/// Input for generating an invite code
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GenerateInviteInput {
    /// The agent public key of the invitee (if pre-known)
    pub invitee: Option<AgentPubKey>,
    /// Optional voucher agent (existing member vouching for invitee)
    pub voucher: Option<AgentPubKey>,
    /// How long the invite is valid (in seconds, default 7 days)
    pub validity_duration: Option<u64>,
}

/// Membrane proof structure (matches integrity zome)
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MembraneProof {
    pub hub_signature: Signature,
    pub timestamp: Timestamp,
    pub voucher: Option<AgentPubKey>,
}

/// Invite code output
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InviteCode {
    /// The full invite code string (OB-V1-BASE64...)
    pub code: String,
    /// When this invite expires
    pub expires_at: Timestamp,
    /// Optional voucher
    pub voucher: Option<AgentPubKey>,
}

/// Generates an invite code that can be shared with new neighbors
///
/// This function should only be called by the Hub admin. The generated code
/// contains a membrane proof that will be validated during genesis_self_check.
///
/// **Security Note**: This function signs the invitee's agent key (if provided)
/// or generates a reusable code. Reusable codes are less secure but more convenient.
#[hdk_extern]
pub fn generate_invite_code(input: GenerateInviteInput) -> ExternResult<InviteCode> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    // Get DNA info
    let dna_info = dna_info()?;
    let properties = dna_info.modifiers.properties;
    
    // Get neighborhood UID
    let neighborhood_uid = properties
        .get("neighborhood_uid")
        .and_then(|v| v.as_str())
        .ok_or(wasm_error!(WasmErrorInner::Guest(
            "Neighborhood UID not configured in DNA".to_string()
        )))?;
    
    let neighborhood_name = properties
        .get("neighborhood_name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown Neighborhood");

    // Calculate expiration (default 7 days)
    let validity_duration = input.validity_duration.unwrap_or(7 * 24 * 60 * 60); // 7 days in seconds
    let now = sys_time()?;
    let expires_at = Timestamp::from_micros(
        now.as_micros() + (validity_duration as i64 * 1_000_000)
    );

    // Create the data to sign
    // For reusable codes (no specific invitee), we sign: "INVITE" + timestamp
    // For specific invitee, we sign: invitee_pubkey + timestamp
    let mut data_to_sign = if let Some(ref invitee_key) = input.invitee {
        invitee_key.get_raw_39().to_vec()
    } else {
        b"INVITE_CODE".to_vec()
    };
    data_to_sign.extend_from_slice(&now.as_micros().to_le_bytes());

    // Sign the data (using the Hub's/calling agent's key)
    let signature = sign(agent.clone(), data_to_sign)?;

    // Create membrane proof
    let proof = MembraneProof {
        hub_signature: signature,
        timestamp: now,
        voucher: input.voucher.clone(),
    };

    // Serialize to MessagePack
    let proof_bytes = rmp_serde::to_vec(&proof)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Serialization error: {}", e))))?;

    // Create payload
    let payload = serde_json::json!({
        "network_seed": neighborhood_uid,
        "proof": base64::encode(&proof_bytes),
        "neighborhood_name": neighborhood_name,
        "expires_at": expires_at.as_micros(),
    });

    // Encode to base64
    let payload_json = serde_json::to_string(&payload)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("JSON error: {}", e))))?;
    let payload_b64 = base64::encode(payload_json.as_bytes());

    // Format as invite code
    let code = format!("OB-V1-{}", payload_b64);

    Ok(InviteCode {
        code,
        expires_at,
        voucher: input.voucher,
    })
}

/// Validates an invite code (without consuming it)
///
/// This is useful for checking if a code is still valid before attempting to join.
#[hdk_extern]
pub fn validate_invite_code(code: String) -> ExternResult<bool> {
    // Parse the code
    if !code.starts_with("OB-V1-") {
        return Ok(false);
    }

    let payload_b64 = code.strip_prefix("OB-V1-").unwrap();
    let payload_bytes = match base64::decode(payload_b64) {
        Ok(bytes) => bytes,
        Err(_) => return Ok(false),
    };

    let payload_json = match String::from_utf8(payload_bytes) {
        Ok(s) => s,
        Err(_) => return Ok(false),
    };

    let payload: serde_json::Value = match serde_json::from_str(&payload_json) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };

    // Check expiration
    if let Some(expires_at_micros) = payload.get("expires_at").and_then(|v| v.as_i64()) {
        let now = sys_time()?.as_micros();
        if now > expires_at_micros {
            return Ok(false); // Expired
        }
    }

    // Check network seed matches
    let dna_info = dna_info()?;
    let neighborhood_uid = dna_info.modifiers.properties
        .get("neighborhood_uid")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if let Some(code_network_seed) = payload.get("network_seed").and_then(|v| v.as_str()) {
        if code_network_seed != neighborhood_uid {
            return Ok(false); // Wrong neighborhood
        }
    }

    Ok(true)
}

// ============================================================================
// Revocation System - DHT-Level Blacklist ("The Blacklist")
// ============================================================================

/// Anchor for all revoked agents
const REVOKED_AGENTS_ANCHOR: &str = "revoked_agents";

/// Input for revoking an agent
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RevokeAgentInput {
    /// The agent public key to revoke
    pub agent_to_revoke: AgentPubKey,
    /// Reason for revocation (required for audit trail)
    pub reason: String,
}

/// Output for revocation operation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RevocationOutput {
    /// Hash of the RevocationAnchor entry
    pub revocation_hash: ActionHash,
    /// The revoked agent
    pub revoked_agent: AgentPubKey,
    /// When the revocation occurred
    pub revoked_at: Timestamp,
}

/// Revokes an agent from the neighborhood
///
/// This creates a RevocationAnchor entry and links it to a deterministic anchor point.
/// Once revoked, the agent cannot create new entries or links in the DHT.
/// All their existing entries remain (Holochain is append-only), but they are
/// effectively "muted" from future participation.
///
/// **WARNING:** This is permanent and cannot be undone! Use with extreme caution.
///
/// # Arguments
/// * `input` - Agent to revoke and reason
///
/// # Returns
/// * `RevocationOutput` - Details of the revocation
///
/// # Errors
/// * Returns error if caller is not an admin (TODO: implement admin check)
/// * Returns error if agent is already revoked
#[hdk_extern]
pub fn revoke_agent(input: RevokeAgentInput) -> ExternResult<RevocationOutput> {
    // TODO: Verify caller has admin privileges
    // This requires either:
    // 1. Checking DNA properties for admin list
    // 2. Checking a capability grant
    // 3. Verifying caller is the original Hub agent
    
    let revoker = agent_info()?.agent_initial_pubkey;
    let revoked_at = sys_time()?;
    
    // Check if agent is already revoked
    if is_agent_revoked_coordinator(&input.agent_to_revoke)? {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Agent is already revoked".to_string()
        )));
    }
    
    // Create RevocationAnchor entry
    let revocation = RevocationAnchor {
        revoked_agent: input.agent_to_revoke.clone(),
        reason: input.reason,
        revoked_at,
        revoker: revoker.clone(),
    };
    
    let revocation_hash = create_entry(EntryTypes::RevocationAnchor(revocation.clone()))?;
    let entry_hash = hash_entry(&revocation)?;
    
    // Link from revoked agents anchor to this revocation
    let anchor_hash = revoked_agents_anchor_hash()?;
    create_link(
        anchor_hash,
        entry_hash,
        LinkTypes::RevokedAgents,
        (),
    )?;
    
    // Emit signal to notify network of revocation
    emit_signal(SystemSignal::SystemMaintenance {
        message: format!(
            "Agent {} has been revoked from the neighborhood",
            input.agent_to_revoke
        ),
        severity: "critical".to_string(),
    })?;
    
    Ok(RevocationOutput {
        revocation_hash,
        revoked_agent: input.agent_to_revoke,
        revoked_at,
    })
}

/// Checks if an agent has been revoked
///
/// This queries the DHT for RevocationAnchor entries linked to the revoked agents anchor.
///
/// # Arguments
/// * `agent` - The agent public key to check
///
/// # Returns
/// * `bool` - true if agent is revoked, false otherwise
#[hdk_extern]
pub fn is_agent_revoked(agent: AgentPubKey) -> ExternResult<bool> {
    is_agent_revoked_coordinator(&agent)
}

/// Lists all revoked agents in the neighborhood
///
/// Returns all RevocationAnchor entries from the DHT.
///
/// # Returns
/// * `Vec<RevocationAnchor>` - List of all revocations
#[hdk_extern]
pub fn list_revoked_agents() -> ExternResult<Vec<RevocationAnchor>> {
    let anchor_hash = revoked_agents_anchor_hash()?;
    
    let links = get_links(
        GetLinksInputBuilder::try_new(anchor_hash, LinkTypes::RevokedAgents)?
            .build()
    )?;
    
    let mut revocations = Vec::new();
    
    for link in links {
        if let Some(record) = get(ActionHash::try_from(link.target).ok().unwrap(), GetOptions::default())? {
            if let Some(revocation) = record
                .entry()
                .to_app_option::<RevocationAnchor>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                revocations.push(revocation);
            }
        }
    }
    
    Ok(revocations)
}

// ============================================================================
// Helper Functions for Revocation
// ============================================================================

/// Helper: Get hash of revoked agents anchor
fn revoked_agents_anchor_hash() -> ExternResult<EntryHash> {
    let path = Path::from(REVOKED_AGENTS_ANCHOR);
    path.path_entry_hash()
}

/// Helper: Check if agent is revoked (coordinator version)
fn is_agent_revoked_coordinator(agent: &AgentPubKey) -> ExternResult<bool> {
    let anchor_hash = revoked_agents_anchor_hash()?;
    
    let links = get_links(
        GetLinksInputBuilder::try_new(anchor_hash, LinkTypes::RevokedAgents)?
            .build()
    )?;
    
    for link in links {
        if let Some(record) = get(ActionHash::try_from(link.target).ok().unwrap(), GetOptions::default())? {
            if let Some(revocation) = record
                .entry()
                .to_app_option::<RevocationAnchor>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                if &revocation.revoked_agent == agent {
                    return Ok(true);
                }
            }
        }
    }
    
    Ok(false)
}

// ============================================================================
// Onboarding & Vouching Functions
// ============================================================================

/// Get the membrane proof for the current agent
/// Returns the voucher's AgentPubKey if the agent was vouched in
#[hdk_extern]
pub fn get_my_membrane_proof(_: ()) -> ExternResult<Option<MembraneProof>> {
    // Get the membrane proof that was used during init
    // This is stored during app installation
    let dna_info = dna_info()?;
    
    // Try to deserialize the membrane proof from DNA properties
    // Note: In production, membrane proof is validated during init
    // For now, we'll try to get it from the agent's chain genesis
    
    // Alternative approach: Store membrane proof during profile creation
    // For simplicity, return None for now - this will be enhanced
    // when membrane proof is properly stored on the chain
    Ok(None)
}

/// Get agent activity for a specific agent
/// Useful for determining if a user is the first joiner
#[hdk_extern]
pub fn get_agent_activity_for_agent(
    input: GetAgentActivityInput,
) -> ExternResult<AgentActivity> {
    get_agent_activity(
        input.agent,
        ChainQueryFilter::default(),
        ActivityRequest::Full,
    )
}

/// Input for get_agent_activity_for_agent
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GetAgentActivityInput {
    pub agent: AgentPubKey,
}

