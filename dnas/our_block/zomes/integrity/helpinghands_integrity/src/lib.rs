use hdi::prelude::*;

/// ───────────────────────────────────────────────────────────────────────────
/// ENTRY TYPES
/// ───────────────────────────────────────────────────────────────────────────

/// Category of mutual aid request
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RequestCategory {
    Grocery,
    Moving,
    Childcare,
    Transportation,
    PetCare,
    Repairs,
    Medical,
    Technology,
    Companionship,
    Other { description: String },
}

/// Urgency level of the request
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Urgency {
    Low,
    High,
    Emergency,
}

/// A mutual aid request from a neighbor
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Request {
    pub title: String,
    pub category: RequestCategory,
    pub urgency: Urgency,
    pub description: String,
    pub author: AgentPubKey,
    pub created_at: Timestamp,
    pub is_fulfilled: bool,
}

/// Validation constants
pub const MIN_TITLE_LENGTH: usize = 3;
pub const MAX_TITLE_LENGTH: usize = 100;
pub const MAX_DESCRIPTION_LENGTH: usize = 2000;

/// A comment offering help on a request
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Comment {
    pub request_hash: ActionHash,
    pub author: AgentPubKey,
    pub content: String,
    pub is_offer: bool, // true = offering help, false = just a comment
    pub created_at: Timestamp,
}

pub const MAX_COMMENT_LENGTH: usize = 1000;

/// ───────────────────────────────────────────────────────────────────────────
/// LINK TYPES
/// ───────────────────────────────────────────────────────────────────────────

#[hdk_link_types]
pub enum LinkTypes {
    /// All requests anchor -> Request
    AllRequests,
    /// Request -> Comments
    RequestToComments,
    /// Agent -> their Requests
    AgentToRequests,
}

/// ───────────────────────────────────────────────────────────────────────────
/// ENTRY DEFS
/// ───────────────────────────────────────────────────────────────────────────

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "request", visibility = "public")]
    Request(Request),
    #[entry_type(name = "comment", visibility = "public")]
    Comment(Comment),
}

/// ───────────────────────────────────────────────────────────────────────────
/// VALIDATION
/// ───────────────────────────────────────────────────────────────────────────

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Request(request) => validate_create_request(request, action),
                EntryTypes::Comment(comment) => validate_create_comment(comment, action),
            },
            OpEntry::UpdateEntry {
                app_entry, action, ..
            } => match app_entry {
                EntryTypes::Request(request) => validate_update_request(request, action),
                EntryTypes::Comment(_) => Ok(ValidateCallbackResult::Invalid(
                    "Comments cannot be updated".to_string(),
                )),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::RegisterCreateLink {
            link_type,
            base_address,
            target_address,
            ..
        } => match link_type {
            LinkTypes::AllRequests => Ok(ValidateCallbackResult::Valid),
            LinkTypes::RequestToComments => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AgentToRequests => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::RegisterDeleteLink { .. } => Ok(ValidateCallbackResult::Valid),
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Request(request) => validate_create_request(request, action),
                EntryTypes::Comment(comment) => validate_create_comment(comment, action),
            },
            OpRecord::UpdateEntry {
                app_entry,
                action,
                ..
            } => match app_entry {
                EntryTypes::Request(request) => validate_update_request(request, action.into()),
                EntryTypes::Comment(_) => Ok(ValidateCallbackResult::Invalid(
                    "Comments cannot be updated".to_string(),
                )),
            },
            OpRecord::DeleteEntry { .. } => Ok(ValidateCallbackResult::Valid),
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::RegisterUpdate(update_entry) => match update_entry {
            OpUpdate::Entry { app_entry, action } => match app_entry {
                EntryTypes::Request(request) => validate_update_request(request, action.into()),
                EntryTypes::Comment(_) => Ok(ValidateCallbackResult::Invalid(
                    "Comments cannot be updated".to_string(),
                )),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::RegisterDelete(_) => Ok(ValidateCallbackResult::Valid),
        FlatOp::RegisterAgentActivity(_) => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_create_request(request: Request, action: Create) -> ExternResult<ValidateCallbackResult> {
    // Title must be within bounds
    if request.title.len() < MIN_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Title must be at least {} characters",
            MIN_TITLE_LENGTH
        )));
    }
    if request.title.len() > MAX_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Title cannot exceed {} characters",
            MAX_TITLE_LENGTH
        )));
    }

    // Description cannot be empty
    if request.description.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Description cannot be empty".to_string(),
        ));
    }

    // Description must be within bounds
    if request.description.len() > MAX_DESCRIPTION_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Description cannot exceed {} characters",
            MAX_DESCRIPTION_LENGTH
        )));
    }

    // Author must match the action author
    if request.author != action.author {
        return Ok(ValidateCallbackResult::Invalid(
            "Request author must match the action author".to_string(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

fn validate_update_request(request: Request, action: Update) -> ExternResult<ValidateCallbackResult> {
    // Basic validation still applies
    if request.title.len() < MIN_TITLE_LENGTH || request.title.len() > MAX_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(
            "Title length out of bounds".to_string(),
        ));
    }

    if request.description.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Description cannot be empty".to_string(),
        ));
    }

    // Only the original author can update
    if request.author != action.author {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the original author can update a request".to_string(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

fn validate_create_comment(comment: Comment, action: Create) -> ExternResult<ValidateCallbackResult> {
    // Content cannot be empty
    if comment.content.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Comment content cannot be empty".to_string(),
        ));
    }

    // Content must be within bounds
    if comment.content.len() > MAX_COMMENT_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Comment cannot exceed {} characters",
            MAX_COMMENT_LENGTH
        )));
    }

    // Author must match the action author
    if comment.author != action.author {
        return Ok(ValidateCallbackResult::Invalid(
            "Comment author must match the action author".to_string(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
