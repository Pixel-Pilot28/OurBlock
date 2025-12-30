use hdi::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum VouchType {
    Neighbor,
    Anchor,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Vouch {
    pub vouchee: AgentPubKey,
    pub vouch_type: VouchType,
    pub created_at: Timestamp,
    pub note: Option<String>,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct TrustedAnchor {
    pub agent: AgentPubKey,
    pub created_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum MembershipStatus {
    Pending,
    Verified,
    Anchor,
}

#[hdk_link_types]
pub enum LinkTypes {
    AgentToVouchesGiven,
    AgentToVouchesReceived,
    AllAnchors,
}

pub const VOUCHES_REQUIRED: usize = 2;
pub const ANCHOR_VOUCHES_REQUIRED: usize = 1;
pub const MAX_NOTE_LENGTH: usize = 500;

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "vouch", visibility = "public")]
    Vouch(Vouch),
    #[entry_type(name = "trusted_anchor", visibility = "public")]
    TrustedAnchor(TrustedAnchor),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Vouch(vouch) => validate_vouch(vouch, action.author.clone()),
                EntryTypes::TrustedAnchor(anchor) => validate_anchor(anchor, action.author.clone()),
            },
            OpEntry::UpdateEntry { app_entry, .. } => match app_entry {
                EntryTypes::Vouch(_) => Ok(ValidateCallbackResult::Invalid("Vouches cannot be updated".into())),
                EntryTypes::TrustedAnchor(_) => Ok(ValidateCallbackResult::Invalid("Anchors cannot be updated".into())),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Vouch(vouch) => validate_vouch(vouch, action.author.clone()),
                EntryTypes::TrustedAnchor(anchor) => validate_anchor(anchor, action.author.clone()),
            },
            OpRecord::UpdateEntry { app_entry, .. } => match app_entry {
                EntryTypes::Vouch(_) => Ok(ValidateCallbackResult::Invalid("Vouches cannot be updated".into())),
                EntryTypes::TrustedAnchor(_) => Ok(ValidateCallbackResult::Invalid("Anchors cannot be updated".into())),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_vouch(vouch: Vouch, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if vouch.vouchee == author {
        return Ok(ValidateCallbackResult::Invalid("Cannot vouch for yourself".into()));
    }
    if let Some(ref note) = vouch.note {
        if note.len() > MAX_NOTE_LENGTH {
            return Ok(ValidateCallbackResult::Invalid(format!("Note cannot exceed {} chars", MAX_NOTE_LENGTH)));
        }
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_anchor(anchor: TrustedAnchor, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if anchor.agent != author {
        return Ok(ValidateCallbackResult::Invalid("Anchor agent must match author".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}
