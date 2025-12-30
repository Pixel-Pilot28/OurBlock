use hdi::prelude::*;

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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Urgency {
    Low,
    High,
    Emergency,
}

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

pub const MIN_TITLE_LENGTH: usize = 3;
pub const MAX_TITLE_LENGTH: usize = 100;
pub const MAX_DESCRIPTION_LENGTH: usize = 2000;

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Comment {
    pub request_hash: ActionHash,
    pub author: AgentPubKey,
    pub content: String,
    pub is_offer: bool,
    pub created_at: Timestamp,
}

pub const MAX_COMMENT_LENGTH: usize = 1000;

#[hdk_link_types]
pub enum LinkTypes {
    AllRequests,
    RequestToComments,
    AgentToRequests,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "request", visibility = "public")]
    Request(Request),
    #[entry_type(name = "comment", visibility = "public")]
    Comment(Comment),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Request(req) => validate_request(req, action.author.clone()),
                EntryTypes::Comment(comment) => validate_comment(comment, action.author.clone()),
            },
            OpEntry::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Request(req) => validate_request(req, action.author.clone()),
                EntryTypes::Comment(_) => Ok(ValidateCallbackResult::Invalid("Comments cannot be updated".into())),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Request(req) => validate_request(req, action.author.clone()),
                EntryTypes::Comment(comment) => validate_comment(comment, action.author.clone()),
            },
            OpRecord::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Request(req) => validate_request(req, action.author.clone()),
                EntryTypes::Comment(_) => Ok(ValidateCallbackResult::Invalid("Comments cannot be updated".into())),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_request(req: Request, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if req.title.len() < MIN_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!("Title must be at least {} chars", MIN_TITLE_LENGTH)));
    }
    if req.title.len() > MAX_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!("Title cannot exceed {} chars", MAX_TITLE_LENGTH)));
    }
    if req.description.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Description cannot be empty".into()));
    }
    if req.description.len() > MAX_DESCRIPTION_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!("Description cannot exceed {} chars", MAX_DESCRIPTION_LENGTH)));
    }
    if req.author != author {
        return Ok(ValidateCallbackResult::Invalid("Request author must match action author".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_comment(comment: Comment, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if comment.content.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Comment cannot be empty".into()));
    }
    if comment.content.len() > MAX_COMMENT_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!("Comment cannot exceed {} chars", MAX_COMMENT_LENGTH)));
    }
    if comment.author != author {
        return Ok(ValidateCallbackResult::Invalid("Comment author must match action author".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}
