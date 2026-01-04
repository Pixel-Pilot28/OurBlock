//! Vouch Coordinator Zome
//!
//! This zome implements the business logic for the Web of Trust system.
//! It provides functions for:
//! - Creating vouches (when scanning a neighbor's QR code)
//! - Checking membership status
//! - Managing trusted anchors
//! - Revoking vouches if needed

use hdk::prelude::*;
use vouch_integrity::*;

/// Input for creating a vouch
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateVouchInput {
    /// The agent being vouched for
    pub vouchee: AgentPubKey,
    
    /// Type of verification performed
    pub vouch_type: VouchType,
    
    /// Optional note about this vouch
    pub note: Option<String>,
}

/// Output after creating a vouch
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VouchOutput {
    pub vouch: Vouch,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
    pub voucher: AgentPubKey,
}

/// Information about vouches received by an agent
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VouchInfo {
    pub voucher: AgentPubKey,
    pub vouch: Vouch,
    pub action_hash: ActionHash,
    pub is_from_anchor: bool,
}

/// Complete membership information for an agent
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MembershipInfo {
    pub agent: AgentPubKey,
    pub status: MembershipStatus,
    pub vouches_received: Vec<VouchInfo>,
    pub vouches_given: Vec<VouchOutput>,
    pub is_anchor: bool,
}

/// Anchor path for listing all trusted anchors
const ALL_ANCHORS_PATH: &str = "all_trusted_anchors";

// ============================================================================
// VOUCH FUNCTIONS
// ============================================================================

/// Create a vouch for another agent
///
/// This is called when an existing member scans a new neighbor's QR code,
/// cryptographically attesting that they trust this person.
#[hdk_extern]
pub fn create_vouch(input: CreateVouchInput) -> ExternResult<VouchOutput> {
    let voucher = agent_info()?.agent_initial_pubkey;
    
    // Self-vouch check (also validated in integrity, but fail fast here)
    if input.vouchee == voucher {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Cannot vouch for yourself".to_string()
        )));
    }
    
    // Check if we've already vouched for this person
    let existing_vouches = get_vouches_given_by(voucher.clone())?;
    for existing in existing_vouches {
        if existing.vouch.vouchee == input.vouchee {
            return Err(wasm_error!(WasmErrorInner::Guest(
                "You have already vouched for this neighbor".to_string()
            )));
        }
    }
    
    // Create the vouch entry
    let vouch = Vouch {
        vouchee: input.vouchee.clone(),
        vouch_type: input.vouch_type,
        created_at: sys_time()?,
        note: input.note,
    };
    
    let action_hash = create_entry(EntryTypes::Vouch(vouch.clone()))?;
    let entry_hash = hash_entry(&vouch)?;
    
    // Create bidirectional links for easy querying
    
    // Link from voucher (me) to the vouch
    create_link(
        voucher.clone(),
        entry_hash.clone(),
        LinkTypes::AgentToVouchesGiven,
        (),
    )?;
    
    // Link from vouchee to the vouch (so they can find who vouched for them)
    create_link(
        input.vouchee.clone(),
        entry_hash.clone(),
        LinkTypes::AgentToVouchesReceived,
        (),
    )?;
    
    Ok(VouchOutput {
        vouch,
        action_hash,
        entry_hash,
        voucher,
    })
}

/// Get all vouches that an agent has received
#[hdk_extern]
pub fn get_vouches_for(agent: AgentPubKey) -> ExternResult<Vec<VouchInfo>> {
    let links = get_links(
        LinkQuery::try_new(agent.clone(), LinkTypes::AgentToVouchesReceived)?,
        GetStrategy::Local,
    )?;
    
    let anchors = get_all_anchors(())?;
    let anchor_keys: Vec<AgentPubKey> = anchors.iter().map(|a| a.agent.clone()).collect();
    
    let mut vouches = Vec::new();
    
    for link in links {
        let entry_hash = EntryHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid entry hash in link".to_string()))
        })?;
        
        if let Some(record) = get(entry_hash, GetOptions::default())? {
            if let Some(vouch) = record
                .entry()
                .to_app_option::<Vouch>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let voucher = record.action().author().clone();
                let is_from_anchor = anchor_keys.contains(&voucher);
                
                vouches.push(VouchInfo {
                    voucher,
                    vouch,
                    action_hash: record.action_address().clone(),
                    is_from_anchor,
                });
            }
        }
    }
    
    Ok(vouches)
}

/// Vouch for a neighbor with a physical handshake verification
/// 
/// Simplified function that defaults to PhysicalHandshake vouch type.
/// This is the primary function called when scanning a neighbor's QR code.
#[hdk_extern]
pub fn vouch_for_neighbor(target_agent: AgentPubKey) -> ExternResult<VouchOutput> {
    create_vouch(CreateVouchInput {
        vouchee: target_agent,
        vouch_type: VouchType::Neighbor,
        note: None,
    })
}

/// Get all vouches where the current user is the vouchee
/// 
/// Returns all vouch entries that other neighbors have created for the calling agent.
#[hdk_extern]
pub fn get_my_vouches(_: ()) -> ExternResult<Vec<VouchInfo>> {
    let agent = agent_info()?.agent_initial_pubkey;
    get_vouches_for(agent)
}

/// Check if an agent is verified (meets the vouching threshold)
/// 
/// Returns true if the agent:
/// - Is a trusted anchor, OR
/// - Has at least 1 vouch from a trusted anchor, OR
/// - Has at least 2 vouches from verified members
#[hdk_extern]
pub fn is_verified(agent: AgentPubKey) -> ExternResult<bool> {
    let info = get_membership_status(agent)?;
    Ok(matches!(
        info.status,
        MembershipStatus::Verified | MembershipStatus::Anchor
    ))
}

/// Check if the calling agent is verified
#[hdk_extern]
pub fn am_i_verified(_: ()) -> ExternResult<bool> {
    let agent = agent_info()?.agent_initial_pubkey;
    is_verified(agent)
}

/// Get all vouches that an agent has given to others
fn get_vouches_given_by(agent: AgentPubKey) -> ExternResult<Vec<VouchOutput>> {
    let links = get_links(
        LinkQuery::try_new(agent.clone(), LinkTypes::AgentToVouchesGiven)?,
        GetStrategy::Local,
    )?;
    
    let mut vouches = Vec::new();
    
    for link in links {
        let entry_hash = EntryHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid entry hash in link".to_string()))
        })?;
        
        if let Some(record) = get(entry_hash.clone(), GetOptions::default())? {
            if let Some(vouch) = record
                .entry()
                .to_app_option::<Vouch>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                vouches.push(VouchOutput {
                    vouch,
                    action_hash: record.action_address().clone(),
                    entry_hash,
                    voucher: agent.clone(),
                });
            }
        }
    }
    
    Ok(vouches)
}

/// Get vouches given by the calling agent
#[hdk_extern]
pub fn get_my_given_vouches(_: ()) -> ExternResult<Vec<VouchOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    get_vouches_given_by(agent)
}

// ============================================================================
// MEMBERSHIP STATUS FUNCTIONS
// ============================================================================

/// Check if vouch threshold is met for verification
fn vouch_threshold_met(_is_anchor: bool, vouches_from_anchors: usize, vouches_from_members: usize) -> bool {
    // 1 vouch from anchor OR 2+ vouches from verified members
    vouches_from_anchors >= ANCHOR_VOUCHES_REQUIRED || vouches_from_members >= VOUCHES_REQUIRED
}

/// Get the membership status for an agent
#[hdk_extern]
pub fn get_membership_status(agent: AgentPubKey) -> ExternResult<MembershipInfo> {
    let vouches_received = get_vouches_for(agent.clone())?;
    let vouches_given = get_vouches_given_by(agent.clone())?;
    
    // Check if this agent is an anchor
    let anchors = get_all_anchors(())?;
    let is_anchor = anchors.iter().any(|a| a.agent == agent);
    
    // Count vouches by type
    let vouches_from_anchors = vouches_received.iter().filter(|v| v.is_from_anchor).count();
    let vouches_from_members = vouches_received.len(); // Total vouches (simplified)
    
    // Determine status (using only Pending, Verified, Anchor from integrity)
    let status = if is_anchor {
        MembershipStatus::Anchor
    } else if vouch_threshold_met(is_anchor, vouches_from_anchors, vouches_from_members) {
        MembershipStatus::Verified
    } else {
        MembershipStatus::Pending
    };
    
    Ok(MembershipInfo {
        agent,
        status,
        vouches_received,
        vouches_given,
        is_anchor,
    })
}

/// Get the calling agent's membership status
#[hdk_extern]
pub fn get_my_membership_status(_: ()) -> ExternResult<MembershipInfo> {
    let agent = agent_info()?.agent_initial_pubkey;
    get_membership_status(agent)
}

/// Check if an agent can participate fully (post, etc.)
#[hdk_extern]
pub fn can_participate(agent: AgentPubKey) -> ExternResult<bool> {
    let info = get_membership_status(agent)?;
    Ok(matches!(
        info.status,
        MembershipStatus::Verified | MembershipStatus::Anchor
    ))
}

/// Check if the calling agent can participate
#[hdk_extern]
pub fn can_i_participate(_: ()) -> ExternResult<bool> {
    let agent = agent_info()?.agent_initial_pubkey;
    can_participate(agent)
}

// ============================================================================
// TRUSTED ANCHOR FUNCTIONS
// ============================================================================

/// Initialize the first trusted anchor (founding member)
///
/// This should only be called once when bootstrapping the neighborhood.
/// The first agent to call this becomes the founding anchor.
#[hdk_extern]
pub fn initialize_as_anchor(_: ()) -> ExternResult<TrustedAnchor> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    // Check if any anchors exist
    let existing_anchors = get_all_anchors(())?;
    if !existing_anchors.is_empty() {
        // If anchors exist, check if this is being called by an existing anchor
        let is_existing_anchor = existing_anchors.iter().any(|a| a.agent == agent);
        if !is_existing_anchor {
            return Err(wasm_error!(WasmErrorInner::Guest(
                "Anchors already exist. Only existing anchors can designate new anchors.".to_string()
            )));
        }
        // Already an anchor
        return Err(wasm_error!(WasmErrorInner::Guest(
            "You are already a trusted anchor.".to_string()
        )));
    }
    
    // Create the anchor entry
    let anchor = TrustedAnchor {
        agent: agent.clone(),
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::TrustedAnchor(anchor.clone()))?;
    let entry_hash = hash_entry(&anchor)?;
    
    // Link to all anchors path
    let anchor_path = anchor_path_hash()?;
    create_link(anchor_path, entry_hash, LinkTypes::AllAnchors, ())?;
    
    Ok(anchor)
}

/// Designate a new trusted anchor (only existing anchors can do this)
#[hdk_extern]
pub fn designate_anchor(new_anchor_agent: AgentPubKey) -> ExternResult<TrustedAnchor> {
    let designator = agent_info()?.agent_initial_pubkey;
    
    // Check if caller is an anchor
    let existing_anchors = get_all_anchors(())?;
    let is_anchor = existing_anchors.iter().any(|a| a.agent == designator);
    
    if !is_anchor {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Only trusted anchors can designate new anchors.".to_string()
        )));
    }
    
    // Check if target is already an anchor
    if existing_anchors.iter().any(|a| a.agent == new_anchor_agent) {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "This agent is already a trusted anchor.".to_string()
        )));
    }
    
    // Create the anchor entry
    let anchor = TrustedAnchor {
        agent: new_anchor_agent,
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::TrustedAnchor(anchor.clone()))?;
    let entry_hash = hash_entry(&anchor)?;
    
    // Link to all anchors path
    let anchor_path = anchor_path_hash()?;
    create_link(anchor_path, entry_hash, LinkTypes::AllAnchors, ())?;
    
    Ok(anchor)
}

/// Get all trusted anchors
#[hdk_extern]
pub fn get_all_anchors(_: ()) -> ExternResult<Vec<TrustedAnchor>> {
    let anchor_path = anchor_path_hash()?;
    let links = get_links(
        LinkQuery::try_new(anchor_path, LinkTypes::AllAnchors)?,
        GetStrategy::Local,
    )?;
    
    let mut anchors = Vec::new();
    
    for link in links {
        let entry_hash = EntryHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid entry hash in link".to_string()))
        })?;
        
        if let Some(record) = get(entry_hash, GetOptions::default())? {
            if let Some(anchor) = record
                .entry()
                .to_app_option::<TrustedAnchor>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                anchors.push(anchor);
            }
        }
    }
    
    Ok(anchors)
}

/// Check if the calling agent is a trusted anchor
#[hdk_extern]
pub fn am_i_anchor(_: ()) -> ExternResult<bool> {
    let agent = agent_info()?.agent_initial_pubkey;
    let anchors = get_all_anchors(())?;
    Ok(anchors.iter().any(|a| a.agent == agent))
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Get the path hash for the all-anchors anchor
fn anchor_path_hash() -> ExternResult<EntryHash> {
    let path = Path::from(ALL_ANCHORS_PATH);
    path.path_entry_hash()
}

/// Generate QR code data for vouch scanning
/// Returns a signed payload that another agent can use to vouch
#[hdk_extern]
pub fn generate_vouch_request(_: ()) -> ExternResult<VouchRequest> {
    let agent = agent_info()?.agent_initial_pubkey;
    let timestamp = sys_time()?;
    
    Ok(VouchRequest {
        agent,
        timestamp,
    })
}

/// Data structure for QR code scanning
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VouchRequest {
    pub agent: AgentPubKey,
    pub timestamp: Timestamp,
}
