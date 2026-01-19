use hdi::prelude::*;

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Space {
    pub name: String,
    pub description: String,
    pub capacity: u32,
    pub available_hours: String, // e.g., "9:00-21:00"
    pub manager: AgentPubKey,
    pub created_at: Timestamp,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Reservation {
    pub space_hash: ActionHash,
    pub reserver: AgentPubKey,
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub purpose: Option<String>,
    pub created_at: Timestamp,
}

pub const MAX_NAME_LENGTH: usize = 100;
pub const MAX_DESCRIPTION_LENGTH: usize = 500;
pub const MAX_PURPOSE_LENGTH: usize = 200;
pub const MAX_AVAILABLE_HOURS_LENGTH: usize = 50;

#[hdk_link_types]
pub enum LinkTypes {
    AllSpaces,
    AgentToSpaces,
    SpaceToReservations,
    AgentToReservations,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "space", visibility = "public")]
    Space(Space),
    #[entry_type(name = "reservation", visibility = "public")]
    Reservation(Reservation),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Space(space) => validate_space(space, action.author.clone()),
                EntryTypes::Reservation(reservation) => validate_reservation(reservation, action.author.clone()),
            },
            OpEntry::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Space(space) => validate_space(space, action.author.clone()),
                _ => Ok(ValidateCallbackResult::Invalid("Only spaces can be updated".into())),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Space(space) => validate_space(space, action.author.clone()),
                EntryTypes::Reservation(reservation) => validate_reservation(reservation, action.author.clone()),
            },
            OpRecord::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Space(space) => validate_space(space, action.author.clone()),
                _ => Ok(ValidateCallbackResult::Invalid("Only spaces can be updated".into())),
            },
            OpRecord::DeleteEntry { original_action_hash, action, .. } => {
                let original_record = must_get_valid_record(original_action_hash)?;
                let original_action = original_record.action().clone();
                let original_action = match original_action {
                    Action::Create(create) => create,
                    _ => return Ok(ValidateCallbackResult::Invalid("Original action must be Create".into())),
                };
                if action.author != original_action.author {
                    return Ok(ValidateCallbackResult::Invalid("Only the author can delete their entry".into()));
                }
                Ok(ValidateCallbackResult::Valid)
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_space(space: Space, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if space.name.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Space name cannot be empty".into()));
    }
    if space.name.len() > MAX_NAME_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Name cannot exceed {} characters", MAX_NAME_LENGTH
        )));
    }
    if space.description.len() > MAX_DESCRIPTION_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Description cannot exceed {} characters", MAX_DESCRIPTION_LENGTH
        )));
    }
    if space.available_hours.len() > MAX_AVAILABLE_HOURS_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Available hours cannot exceed {} characters", MAX_AVAILABLE_HOURS_LENGTH
        )));
    }
    if space.capacity == 0 {
        return Ok(ValidateCallbackResult::Invalid("Capacity must be greater than 0".into()));
    }
    if space.manager != author {
        return Ok(ValidateCallbackResult::Invalid("Space manager must match action author".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_reservation(reservation: Reservation, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if reservation.reserver != author {
        return Ok(ValidateCallbackResult::Invalid("Reserver must match action author".into()));
    }
    if reservation.start_time >= reservation.end_time {
        return Ok(ValidateCallbackResult::Invalid("Start time must be before end time".into()));
    }
    if let Some(ref purpose) = reservation.purpose {
        if purpose.len() > MAX_PURPOSE_LENGTH {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "Purpose cannot exceed {} characters", MAX_PURPOSE_LENGTH
            )));
        }
    }
    Ok(ValidateCallbackResult::Valid)
}
