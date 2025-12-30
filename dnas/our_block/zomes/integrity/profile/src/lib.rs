use hdi::prelude::*;

/// A neighbor's public profile in the community.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Profile {
    pub nickname: String,
    pub bio: Option<String>,
    pub avatar_hash: Option<EntryHash>,
}

pub const MIN_NICKNAME_LENGTH: usize = 2;
pub const MAX_NICKNAME_LENGTH: usize = 50;
pub const MAX_BIO_LENGTH: usize = 500;

#[hdk_link_types]
pub enum LinkTypes {
    AgentToProfile,
    AllProfiles,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "profile", visibility = "public")]
    Profile(Profile),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, .. } => match app_entry {
                EntryTypes::Profile(profile) => validate_profile(profile),
            },
            OpEntry::UpdateEntry { app_entry, .. } => match app_entry {
                EntryTypes::Profile(profile) => validate_profile(profile),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, .. } => match app_entry {
                EntryTypes::Profile(profile) => validate_profile(profile),
            },
            OpRecord::UpdateEntry { app_entry, .. } => match app_entry {
                EntryTypes::Profile(profile) => validate_profile(profile),
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
    Ok(ValidateCallbackResult::Valid)
}
