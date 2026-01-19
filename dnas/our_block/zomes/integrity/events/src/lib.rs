use hdi::prelude::*;

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Event {
    pub title: String,
    pub description: String,
    pub location: String,
    pub event_date: Timestamp,
    pub host: AgentPubKey,
    pub attendees: Vec<AgentPubKey>,
    pub max_attendees: Option<u32>,
    pub created_at: Timestamp,
}

pub const MAX_TITLE_LENGTH: usize = 100;
pub const MAX_DESCRIPTION_LENGTH: usize = 2000;
pub const MAX_LOCATION_LENGTH: usize = 200;
pub const MAX_ATTENDEES: usize = 100;

#[hdk_link_types]
pub enum LinkTypes {
    AllEvents,
    AgentToEvents,
    AgentToAttendingEvents,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "event", visibility = "public")]
    Event(Event),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Event(event) => validate_event(event, action.author.clone()),
            },
            OpEntry::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Event(event) => validate_event(event, action.author.clone()),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Event(event) => validate_event(event, action.author.clone()),
            },
            OpRecord::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Event(event) => validate_event(event, action.author.clone()),
            },
            OpRecord::DeleteEntry { original_action_hash, action, .. } => {
                let original_record = must_get_valid_record(original_action_hash)?;
                let original_action = original_record.action().clone();
                let original_action = match original_action {
                    Action::Create(create) => create,
                    _ => return Ok(ValidateCallbackResult::Invalid("Original action must be Create".into())),
                };
                if action.author != original_action.author {
                    return Ok(ValidateCallbackResult::Invalid("Only the event host can delete the event".into()));
                }
                Ok(ValidateCallbackResult::Valid)
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_event(event: Event, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if event.title.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Event title cannot be empty".into()));
    }
    if event.title.len() > MAX_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Title cannot exceed {} characters", MAX_TITLE_LENGTH
        )));
    }
    if event.description.len() > MAX_DESCRIPTION_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Description cannot exceed {} characters", MAX_DESCRIPTION_LENGTH
        )));
    }
    if event.location.len() > MAX_LOCATION_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Location cannot exceed {} characters", MAX_LOCATION_LENGTH
        )));
    }
    if event.attendees.len() > MAX_ATTENDEES {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Cannot have more than {} attendees", MAX_ATTENDEES
        )));
    }
    if let Some(max) = event.max_attendees {
        if max == 0 {
            return Ok(ValidateCallbackResult::Invalid("Max attendees must be greater than 0".into()));
        }
        if event.attendees.len() > max as usize {
            return Ok(ValidateCallbackResult::Invalid("Attendees exceed max_attendees limit".into()));
        }
    }
    if event.host != author {
        return Ok(ValidateCallbackResult::Invalid("Event host must match action author".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}
