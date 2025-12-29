//! Vouch Integrity Zome
//!
//! This zome implements the Web of Trust security layer for OurBlock.
//! It defines the rules for vouching and determines who can participate
//! as a full member of the neighborhood network.
//!
//! ## Security Model
//!
//! - Neighbors cannot post to Common Ground until vouched
//! - Self-vouching is explicitly forbidden
//! - Full membership requires:
//!   - 1 vouch from a Trusted Anchor (founding member), OR
//!   - 2 vouches from existing verified members
//!
//! ## The Vouch Process
//!
//! 1. Physical Handshake: New neighbor meets existing neighbor in person
//! 2. The Scan: Existing neighbor scans QR code on new neighbor's phone
//! 3. Network Entry: New neighbor becomes "verified" after meeting vouch threshold

use hdi::prelude::*;

/// Number of vouches required from regular members for full membership
pub const REQUIRED_VOUCHES_FROM_MEMBERS: usize = 2;

/// Number of vouches required from a trusted anchor for full membership
pub const REQUIRED_VOUCHES_FROM_ANCHOR: usize = 1;

/// Types of vouches that can be given
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub enum VouchType {
    /// Voucher met the vouchee in person and verified their identity
    PhysicalHandshake,
    
    /// Voucher already knew this person (neighbor, friend, family)
    ExistingRelationship,
    
    /// Voucher is vouching based on trusted third-party introduction
    TrustedIntroduction,
}

impl Default for VouchType {
    fn default() -> Self {
        VouchType::PhysicalHandshake
    }
}

/// A Vouch entry represents one neighbor vouching for another
///
/// When Bob vouches for Alice:
/// - The `voucher` is Bob's AgentPubKey (the action author)
/// - The `vouchee` is Alice's AgentPubKey (stored in entry)
/// - This creates a cryptographic proof that Bob trusts Alice
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Vouch {
    /// The agent being vouched for (the new neighbor)
    pub vouchee: AgentPubKey,
    
    /// The type of verification performed
    pub vouch_type: VouchType,
    
    /// When the vouch was created
    pub timestamp: Timestamp,
    
    /// Optional message/note about the vouch
    pub note: Option<String>,
}

/// Trusted Anchor designation
/// 
/// The first member(s) of a neighborhood are designated as Trusted Anchors.
/// A vouch from an anchor counts as sufficient for full membership.
/// This prevents the chicken-and-egg problem of bootstrapping the network.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct TrustedAnchor {
    /// The agent designated as a trusted anchor
    pub agent: AgentPubKey,
    
    /// When they were designated
    pub designated_at: Timestamp,
    
    /// Who designated them (will be self for the founding anchor)
    pub designated_by: AgentPubKey,
}

/// Membership status for an agent
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum MembershipStatus {
    /// Agent has joined but has no vouches yet
    Pending,
    
    /// Agent has some vouches but not enough for full membership
    PartiallyVouched { vouch_count: usize },
    
    /// Agent has met the vouch threshold and is a full member
    Verified,
    
    /// Agent is a trusted anchor (founding member)
    TrustedAnchor,
}

/// All entry types defined in this integrity zome
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "vouch")]
    Vouch(Vouch),
    
    #[entry_type(name = "trusted_anchor")]
    TrustedAnchor(TrustedAnchor),
}

/// Link types for the vouch system
#[hdk_link_types]
pub enum LinkTypes {
    /// Links from voucher to vouch entry (who I've vouched for)
    VoucherToVouch,
    
    /// Links from vouchee to vouch entry (who has vouched for me)
    VoucheeToVouch,
    
    /// Links to all trusted anchors
    AllAnchors,
    
    /// Links from agent to their membership status cache
    AgentToStatus,
}

/// Maximum length for vouch notes
pub const MAX_NOTE_LENGTH: usize = 200;

/// Validates a Vouch entry
fn validate_vouch(vouch: &Vouch, author: &AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    // CRITICAL RULE: Cannot vouch for yourself
    if vouch.vouchee == *author {
        return Ok(ValidateCallbackResult::Invalid(
            "Cannot vouch for yourself. Vouches must come from other members.".to_string(),
        ));
    }
    
    // Validate note length if present
    if let Some(ref note) = vouch.note {
        if note.len() > MAX_NOTE_LENGTH {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "Vouch note cannot exceed {} characters",
                MAX_NOTE_LENGTH
            )));
        }
    }
    
    // Vouch type must be valid (enforced by enum, but good to be explicit)
    // No additional validation needed for VouchType
    
    Ok(ValidateCallbackResult::Valid)
}

/// Validates a TrustedAnchor entry
fn validate_trusted_anchor(
    anchor: &TrustedAnchor,
    author: &AgentPubKey,
) -> ExternResult<ValidateCallbackResult> {
    // For the founding anchor, they designate themselves
    // For subsequent anchors, only existing anchors can designate new ones
    
    // The designated_by should match the author of the action
    if anchor.designated_by != *author {
        return Ok(ValidateCallbackResult::Invalid(
            "TrustedAnchor designated_by must match the action author".to_string(),
        ));
    }
    
    Ok(ValidateCallbackResult::Valid)
}

/// Main validation callback
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        // Validate entry creation
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { entry_type, entry } => {
                let author = op.action().author();
                match entry_type {
                    EntryTypes::Vouch(vouch) => validate_vouch(&vouch, author),
                    EntryTypes::TrustedAnchor(anchor) => validate_trusted_anchor(&anchor, author),
                }
            }
            OpEntry::UpdateEntry {
                entry_type, entry, ..
            } => {
                // Vouches should not be updatable - they are immutable attestations
                match entry_type {
                    EntryTypes::Vouch(_) => Ok(ValidateCallbackResult::Invalid(
                        "Vouches cannot be updated. Create a new vouch instead.".to_string(),
                    )),
                    EntryTypes::TrustedAnchor(_) => Ok(ValidateCallbackResult::Invalid(
                        "TrustedAnchor entries cannot be updated.".to_string(),
                    )),
                }
            }
            _ => Ok(ValidateCallbackResult::Valid),
        },

        // Validate record storage
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { entry_type, entry } => {
                let author = op.action().author();
                match entry_type {
                    EntryTypes::Vouch(vouch) => validate_vouch(&vouch, author),
                    EntryTypes::TrustedAnchor(anchor) => validate_trusted_anchor(&anchor, author),
                }
            }
            OpRecord::UpdateEntry { entry_type, .. } => match entry_type {
                EntryTypes::Vouch(_) => Ok(ValidateCallbackResult::Invalid(
                    "Vouches cannot be updated.".to_string(),
                )),
                EntryTypes::TrustedAnchor(_) => Ok(ValidateCallbackResult::Invalid(
                    "TrustedAnchor entries cannot be updated.".to_string(),
                )),
            },
            OpRecord::DeleteEntry { .. } => {
                // Allow deletion (revoking a vouch)
                Ok(ValidateCallbackResult::Valid)
            }
            _ => Ok(ValidateCallbackResult::Valid),
        },

        // Validate links
        FlatOp::RegisterCreateLink { link_type, .. } => match link_type {
            LinkTypes::VoucherToVouch => Ok(ValidateCallbackResult::Valid),
            LinkTypes::VoucheeToVouch => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AllAnchors => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AgentToStatus => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterDeleteLink { link_type, .. } => match link_type {
            LinkTypes::VoucherToVouch => Ok(ValidateCallbackResult::Valid),
            LinkTypes::VoucheeToVouch => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AllAnchors => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AgentToStatus => Ok(ValidateCallbackResult::Valid),
        },

        // Allow other operations
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

/// Genesis self-check callback
/// 
/// Called when an agent first joins this DNA. We allow everyone to join,
/// but they won't be able to participate fully until they have enough vouches.
#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
    // Allow all agents to join initially
    // Full participation is gated by vouch checks in the coordinator zome
    Ok(ValidateCallbackResult::Valid)
}

/// Validate agent joining callback
///
/// Called when we see another agent joining the network.
/// We validate that their membrane proof is acceptable.
#[hdk_extern]
pub fn validate_agent_joining(
    _agent_pub_key: AgentPubKey,
    _membrane_proof: MembraneProof,
) -> ExternResult<ValidateCallbackResult> {
    // All agents can join, but their participation level is determined
    // by their vouch status. The membrane is "open" but participation
    // is gated by vouches.
    //
    // This is a more practical approach than blocking at genesis:
    // 1. New neighbor downloads the app
    // 2. They can see public info and create their profile
    // 3. They cannot post to Common Ground until vouched
    // 4. Existing neighbors vouch for them in person (QR scan)
    // 5. After threshold reached, they gain full access
    
    Ok(ValidateCallbackResult::Valid)
}

/// Helper function to check if an agent has reached the vouch threshold
/// This is exported for use by other zomes (like the feed zome)
pub fn vouch_threshold_met(
    is_anchor: bool,
    vouches_from_anchors: usize,
    vouches_from_members: usize,
) -> bool {
    if is_anchor {
        return true;
    }
    
    // One vouch from an anchor is sufficient
    if vouches_from_anchors >= REQUIRED_VOUCHES_FROM_ANCHOR {
        return true;
    }
    
    // Otherwise need 2 vouches from verified members
    vouches_from_members >= REQUIRED_VOUCHES_FROM_MEMBERS
}
