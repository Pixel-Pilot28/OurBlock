//! Feed Integrity Zome
//!
//! This zome defines the data structures and validation rules for the
//! "Common Ground" feed in OurBlock. Posts are the primary content type
//! where verified neighbors can share updates with the block.
//!
//! ## Security Model
//!
//! Posts can only be created by verified members (checked in coordinator).
//! The integrity zome validates the structure and content of posts.

use hdi::prelude::*;

/// Minimum length for post titles
pub const MIN_TITLE_LENGTH: usize = 5;

/// Maximum length for post titles
pub const MAX_TITLE_LENGTH: usize = 100;

/// Maximum length for post content
pub const MAX_CONTENT_LENGTH: usize = 5000;

/// A Post in the Common Ground feed
///
/// Posts are the primary way neighbors share updates, news, and
/// information with the block.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Post {
    /// Title of the post (5-100 characters)
    pub title: String,
    
    /// Content/body of the post (cannot be empty)
    pub content: String,
    
    /// The author's public key
    pub author: AgentPubKey,
    
    /// When the post was created
    pub created_at: Timestamp,
}

/// All entry types defined in this integrity zome
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "post")]
    Post(Post),
}

/// Link types for the feed
#[hdk_link_types]
pub enum LinkTypes {
    /// Links from an agent's public key to their posts
    AgentToPosts,
    
    /// Links all posts for global discovery
    AllPosts,
}

/// Validates a Post entry
fn validate_post(post: &Post, author: &AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    // Validate that the post author matches the action author
    if post.author != *author {
        return Ok(ValidateCallbackResult::Invalid(
            "Post author must match the action author".to_string(),
        ));
    }
    
    // Validate title length - minimum
    if post.title.len() < MIN_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Title must be at least {} characters",
            MIN_TITLE_LENGTH
        )));
    }
    
    // Validate title length - maximum
    if post.title.len() > MAX_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Title cannot exceed {} characters",
            MAX_TITLE_LENGTH
        )));
    }
    
    // Validate title is not just whitespace
    if post.title.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Title cannot be empty or just whitespace".to_string(),
        ));
    }
    
    // Validate content is not empty
    if post.content.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Content cannot be empty".to_string(),
        ));
    }
    
    // Validate content is not just whitespace
    if post.content.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Content cannot be just whitespace".to_string(),
        ));
    }
    
    // Validate content length
    if post.content.len() > MAX_CONTENT_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Content cannot exceed {} characters",
            MAX_CONTENT_LENGTH
        )));
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
                    EntryTypes::Post(post) => validate_post(&post, author),
                }
            }
            OpEntry::UpdateEntry {
                entry_type, entry, ..
            } => {
                let author = op.action().author();
                match entry_type {
                    EntryTypes::Post(post) => {
                        // Only the original author can update their post
                        if post.author != *author {
                            return Ok(ValidateCallbackResult::Invalid(
                                "Only the original author can update a post".to_string(),
                            ));
                        }
                        validate_post(&post, author)
                    }
                }
            }
            _ => Ok(ValidateCallbackResult::Valid),
        },

        // Validate record storage
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { entry_type, entry } => {
                let author = op.action().author();
                match entry_type {
                    EntryTypes::Post(post) => validate_post(&post, author),
                }
            }
            OpRecord::UpdateEntry {
                entry_type, entry, ..
            } => {
                let author = op.action().author();
                match entry_type {
                    EntryTypes::Post(post) => {
                        if post.author != *author {
                            return Ok(ValidateCallbackResult::Invalid(
                                "Only the original author can update a post".to_string(),
                            ));
                        }
                        validate_post(&post, author)
                    }
                }
            }
            OpRecord::DeleteEntry { .. } => {
                // Allow deletion by the author (checked elsewhere if needed)
                Ok(ValidateCallbackResult::Valid)
            }
            _ => Ok(ValidateCallbackResult::Valid),
        },

        // Validate links
        FlatOp::RegisterCreateLink { link_type, .. } => match link_type {
            LinkTypes::AgentToPosts => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AllPosts => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterDeleteLink { link_type, .. } => match link_type {
            LinkTypes::AgentToPosts => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AllPosts => Ok(ValidateCallbackResult::Valid),
        },

        // Allow other operations
        _ => Ok(ValidateCallbackResult::Valid),
    }
}
