//! Profile Integrity Zome
//!
//! This zome defines the data structures and validation rules for user profiles
//! in OurBlock. Following the "Integrity First" principle, we define WHAT data
//! looks like and HOW it must be validated before writing any coordinator logic.

use hdi::prelude::*;

/// Maximum length for a nickname (in characters)
pub const MAX_NICKNAME_LENGTH: usize = 50;

/// Maximum length for a bio (in characters)
pub const MAX_BIO_LENGTH: usize = 500;

/// Minimum length for a nickname (in characters)
pub const MIN_NICKNAME_LENGTH: usize = 2;

/// Profile entry representing a neighbor's identity in OurBlock
///
/// Each user has exactly one profile, anchored to their agent public key.
/// The profile can be updated but the history is preserved on their source chain.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Profile {
    /// Display name for the neighbor (required)
    pub nickname: String,

    /// Optional biography or description
    pub bio: Option<String>,

    /// Timestamp when the profile was created/updated
    pub created_at: Timestamp,
}

/// All entry types defined in this integrity zome
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "profile")]
    Profile(Profile),
}

/// Link types for connecting entries
#[hdk_link_types]
pub enum LinkTypes {
    /// Links an agent's public key to their profile entry
    AgentToProfile,
    /// Links all profiles for discovery (optional, for listing all neighbors)
    AllProfiles,
}

/// Validates profile entry data
///
/// Returns Ok(()) if valid, or an error describing the validation failure.
pub fn validate_profile(profile: &Profile) -> ExternResult<ValidateCallbackResult> {
    // Validate nickname length
    if profile.nickname.len() < MIN_NICKNAME_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Nickname must be at least {} characters",
            MIN_NICKNAME_LENGTH
        )));
    }

    if profile.nickname.len() > MAX_NICKNAME_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Nickname cannot exceed {} characters",
            MAX_NICKNAME_LENGTH
        )));
    }

    // Validate nickname is not just whitespace
    if profile.nickname.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Nickname cannot be empty or just whitespace".to_string(),
        ));
    }

    // Validate bio length if present
    if let Some(ref bio) = profile.bio {
        if bio.len() > MAX_BIO_LENGTH {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "Bio cannot exceed {} characters",
                MAX_BIO_LENGTH
            )));
        }
    }

    Ok(ValidateCallbackResult::Valid)
}

/// Validation callback for all operations in this zome
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        // Validate entry creation
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { entry_type, entry } => match entry_type {
                EntryTypes::Profile(profile) => validate_profile(&profile),
            },
            OpEntry::UpdateEntry {
                entry_type,
                entry,
                original_action_hash: _,
                original_entry_hash: _,
            } => match entry_type {
                EntryTypes::Profile(profile) => validate_profile(&profile),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },

        // Validate record storage (includes action validation)
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { entry_type, entry } => match entry_type {
                EntryTypes::Profile(profile) => validate_profile(&profile),
            },
            OpRecord::UpdateEntry {
                entry_type,
                entry,
                original_action_hash: _,
                original_entry_hash: _,
            } => match entry_type {
                EntryTypes::Profile(profile) => validate_profile(&profile),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },

        // Validate links
        FlatOp::RegisterCreateLink {
            link_type,
            base_address,
            target_address,
            tag: _,
        } => match link_type {
            LinkTypes::AgentToProfile => {
                // The base should be an agent public key
                // Target should be a profile entry hash
                Ok(ValidateCallbackResult::Valid)
            }
            LinkTypes::AllProfiles => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterDeleteLink {
            link_type,
            original_link: _,
            base_address: _,
            target_address: _,
            tag: _,
        } => match link_type {
            LinkTypes::AgentToProfile => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AllProfiles => Ok(ValidateCallbackResult::Valid),
        },

        // Allow other operations
        _ => Ok(ValidateCallbackResult::Valid),
    }
}
