use hdi::prelude::*;

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Post {
    pub title: String,
    pub content: String,
    pub author: AgentPubKey,
    pub created_at: Timestamp,
}

pub const MIN_TITLE_LENGTH: usize = 5;
pub const MAX_TITLE_LENGTH: usize = 100;
pub const MAX_CONTENT_LENGTH: usize = 10000;

#[hdk_link_types]
pub enum LinkTypes {
    AgentToPosts,
    AllPosts,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "post", visibility = "public")]
    Post(Post),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Post(post) => validate_post(post, action.author.clone()),
            },
            OpEntry::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Post(post) => validate_post(post, action.author.clone()),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Post(post) => validate_post(post, action.author.clone()),
            },
            OpRecord::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Post(post) => validate_post(post, action.author.clone()),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_post(post: Post, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if post.title.len() < MIN_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Title must be at least {} characters", MIN_TITLE_LENGTH
        )));
    }
    if post.title.len() > MAX_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Title cannot exceed {} characters", MAX_TITLE_LENGTH
        )));
    }
    if post.content.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Content cannot be empty".into()));
    }
    if post.content.len() > MAX_CONTENT_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Content cannot exceed {} characters", MAX_CONTENT_LENGTH
        )));
    }
    if post.author != author {
        return Ok(ValidateCallbackResult::Invalid("Post author must match action author".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}
