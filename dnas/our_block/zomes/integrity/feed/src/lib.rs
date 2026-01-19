use hdi::prelude::*;

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Post {
    pub title: String,
    pub content: String,
    pub author: AgentPubKey,
    pub created_at: Timestamp,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Reaction {
    pub post_hash: ActionHash,
    pub author: AgentPubKey,
    pub reaction_type: String, // "like", "love", "celebrate", etc.
    pub created_at: Timestamp,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Comment {
    pub post_hash: ActionHash,
    pub author: AgentPubKey,
    pub content: String,
    pub created_at: Timestamp,
}

pub const MIN_TITLE_LENGTH: usize = 5;
pub const MAX_TITLE_LENGTH: usize = 100;
pub const MAX_CONTENT_LENGTH: usize = 10000;
pub const MAX_COMMENT_LENGTH: usize = 1000;
pub const MAX_REACTION_TYPE_LENGTH: usize = 20;

#[hdk_link_types]
pub enum LinkTypes {
    AgentToPosts,
    AllPosts,
    PostToReactions,
    PostToComments,
    AgentToReactions,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "post", visibility = "public")]
    Post(Post),
    #[entry_type(name = "reaction", visibility = "public")]
    Reaction(Reaction),
    #[entry_type(name = "comment", visibility = "public")]
    Comment(Comment),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Post(post) => validate_post(post, action.author.clone()),
                EntryTypes::Reaction(reaction) => validate_reaction(reaction, action.author.clone()),
                EntryTypes::Comment(comment) => validate_comment(comment, action.author.clone()),
            },
            OpEntry::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Post(post) => validate_post(post, action.author.clone()),
                _ => Ok(ValidateCallbackResult::Invalid("Only posts can be updated".into())),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Post(post) => validate_post(post, action.author.clone()),
                EntryTypes::Reaction(reaction) => validate_reaction(reaction, action.author.clone()),
                EntryTypes::Comment(comment) => validate_comment(comment, action.author.clone()),
            },
            OpRecord::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Post(post) => validate_post(post, action.author.clone()),
                _ => Ok(ValidateCallbackResult::Invalid("Only posts can be updated".into())),
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

fn validate_reaction(reaction: Reaction, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if reaction.author != author {
        return Ok(ValidateCallbackResult::Invalid("Reaction author must match action author".into()));
    }
    if reaction.reaction_type.is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Reaction type cannot be empty".into()));
    }
    if reaction.reaction_type.len() > MAX_REACTION_TYPE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Reaction type cannot exceed {} characters", MAX_REACTION_TYPE_LENGTH
        )));
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_comment(comment: Comment, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if comment.author != author {
        return Ok(ValidateCallbackResult::Invalid("Comment author must match action author".into()));
    }
    if comment.content.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Comment content cannot be empty".into()));
    }
    if comment.content.len() > MAX_COMMENT_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Comment cannot exceed {} characters", MAX_COMMENT_LENGTH
        )));
    }
    Ok(ValidateCallbackResult::Valid)
}
