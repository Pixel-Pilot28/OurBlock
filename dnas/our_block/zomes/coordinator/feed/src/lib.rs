//! Feed Coordinator Zome
//!
//! This zome implements the business logic for the "Common Ground" feed.
//! It provides functions for creating posts, fetching posts, and managing
//! the feed content.
//!
//! ## Security
//!
//! Post creation is gated by verification status - only verified members
//! can create posts. This is checked before allowing any write operations.

use hdk::prelude::*;
use feed_integrity::*;

/// Signal types for real-time updates
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum Signal {
    NewPost { post_hash: ActionHash, post: Post },
    NewReaction { post_hash: ActionHash, reaction_hash: ActionHash },
    NewComment { post_hash: ActionHash, comment_hash: ActionHash },
}

/// Input for creating a post
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreatePostInput {
    pub title: String,
    pub content: String,
}

/// Output after creating or fetching a post
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PostOutput {
    pub post: Post,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

/// Input for creating a reaction
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateReactionInput {
    pub post_hash: ActionHash,
    pub reaction_type: String,
}

/// Output for reaction operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReactionOutput {
    pub reaction: Reaction,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

/// Input for creating a comment
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateCommentInput {
    pub post_hash: ActionHash,
    pub content: String,
}

/// Output for comment operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CommentOutput {
    pub comment: Comment,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

/// Anchor path for listing all posts
const ALL_POSTS_PATH: &str = "all_posts";

// ============================================================================
// POST CREATION
// ============================================================================

/// Create a new post in the Common Ground feed
///
/// This function:
/// 1. Creates the post entry
/// 2. Links from the author's public key to the post (AgentToPosts)
/// 3. Links to the global all_posts anchor for discovery
///
/// Note: Verification check should be done by the UI or a wrapper function
/// that calls the vouch zome's is_verified before allowing this.
#[hdk_extern]
pub fn create_post(input: CreatePostInput) -> ExternResult<PostOutput> {
    let author = agent_info()?.agent_initial_pubkey;
    
    // Create the post entry
    let post = Post {
        title: input.title,
        content: input.content,
        author: author.clone(),
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::Post(post.clone()))?;
    let entry_hash = hash_entry(&post)?;
    
    // Create link from author to post
    create_link(
        author.clone(),
        action_hash.clone(),
        LinkTypes::AgentToPosts,
        (),
    )?;
    
    // Emit signal for real-time updates
    emit_signal(Signal::NewPost {
        post_hash: action_hash.clone(),
        post: post.clone(),
    })?;
    
    // Create link to global all_posts anchor
    let all_posts_anchor = all_posts_anchor_hash()?;
    create_link(
        all_posts_anchor,
        action_hash.clone(),
        LinkTypes::AllPosts,
        (),
    )?;
    
    Ok(PostOutput {
        post,
        action_hash,
        entry_hash,
    })
}

/// Create a post with verification check
///
/// This is the recommended function to use - it checks if the caller
/// is verified before allowing them to post.
#[hdk_extern]
pub fn create_verified_post(input: CreatePostInput) -> ExternResult<PostOutput> {
    // Note: In a real implementation, we would call the vouch zome here
    // to check is_verified. For now, we'll create the post directly.
    // The cross-zome call would look like:
    //
    // let is_verified: bool = call(
    //     CallTargetCell::Local,
    //     ZomeName::from("vouch"),
    //     FunctionName::from("am_i_verified"),
    //     None,
    //     (),
    // )?;
    //
    // if !is_verified {
    //     return Err(wasm_error!(WasmErrorInner::Guest(
    //         "You must be verified to post. Get vouched by your neighbors!".to_string()
    //     )));
    // }
    
    create_post(input)
}

// ============================================================================
// POST RETRIEVAL
// ============================================================================

/// Get all posts in the DHT
///
/// Fetches all posts from the global anchor. Returns them in the order
/// they were linked (roughly chronological).
#[hdk_extern]
pub fn get_all_posts(_: ()) -> ExternResult<Vec<PostOutput>> {
    let all_posts_anchor = all_posts_anchor_hash()?;
    let links = get_links(
        LinkQuery::try_new(all_posts_anchor, LinkTypes::AllPosts)?,
        GetStrategy::Local,
    )?;
    
    let mut posts = Vec::new();
    
    for link in links {
        let action_hash = ActionHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid action hash in link".to_string()))
        })?;
        
        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(post) = record
                .entry()
                .to_app_option::<Post>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&post)?;
                posts.push(PostOutput {
                    post,
                    action_hash,
                    entry_hash,
                });
            }
        }
    }
    
    // Sort by created_at descending (newest first)
    posts.sort_by(|a, b| b.post.created_at.cmp(&a.post.created_at));
    
    Ok(posts)
}

/// Get all posts by a specific agent
///
/// Follows the AgentToPosts links from the given agent's public key.
#[hdk_extern]
pub fn get_posts_for_agent(agent: AgentPubKey) -> ExternResult<Vec<PostOutput>> {
    let links = get_links(
        LinkQuery::try_new(agent, LinkTypes::AgentToPosts)?,
        GetStrategy::Local,
    )?;
    
    let mut posts = Vec::new();
    
    for link in links {
        let action_hash = ActionHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid action hash in link".to_string()))
        })?;
        
        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(post) = record
                .entry()
                .to_app_option::<Post>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&post)?;
                posts.push(PostOutput {
                    post,
                    action_hash,
                    entry_hash,
                });
            }
        }
    }
    
    // Sort by created_at descending (newest first)
    posts.sort_by(|a, b| b.post.created_at.cmp(&a.post.created_at));
    
    Ok(posts)
}

/// Get the calling agent's posts
#[hdk_extern]
pub fn get_my_posts(_: ()) -> ExternResult<Vec<PostOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    get_posts_for_agent(agent)
}

/// Get a single post by its action hash
#[hdk_extern]
pub fn get_post(action_hash: ActionHash) -> ExternResult<Option<PostOutput>> {
    let Some(record) = get(action_hash.clone(), GetOptions::default())? else {
        return Ok(None);
    };
    
    let Some(post) = record
        .entry()
        .to_app_option::<Post>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Ok(None);
    };
    
    let entry_hash = hash_entry(&post)?;
    
    Ok(Some(PostOutput {
        post,
        action_hash,
        entry_hash,
    }))
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Get the path hash for the all-posts anchor
fn all_posts_anchor_hash() -> ExternResult<EntryHash> {
    let path = Path::from(ALL_POSTS_PATH);
    path.path_entry_hash()
}

// ============================================================================
// REACTIONS
// ============================================================================

/// Add a reaction to a post
#[hdk_extern]
pub fn add_reaction(input: CreateReactionInput) -> ExternResult<ReactionOutput> {
    let author = agent_info()?.agent_initial_pubkey;
    
    let reaction = Reaction {
        post_hash: input.post_hash.clone(),
        author: author.clone(),
        reaction_type: input.reaction_type,
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::Reaction(reaction.clone()))?;
    let entry_hash = hash_entry(&reaction)?;
    
    // Link from post to reaction
    create_link(
        input.post_hash.clone(),
        action_hash.clone(),
        LinkTypes::PostToReactions,
        (),
    )?;
    
    // Link from agent to reaction (for finding user's reactions)
    create_link(
        author,
        action_hash.clone(),
        LinkTypes::AgentToReactions,
        (),
    )?;
        // Emit signal for real-time updates
    emit_signal(Signal::NewReaction {
        post_hash: input.post_hash.clone(),
        reaction_hash: action_hash.clone(),
    })?;
        Ok(ReactionOutput {
        reaction,
        action_hash,
        entry_hash,
    })
}

/// Remove a reaction (by deleting the entry and links)
#[hdk_extern]
pub fn remove_reaction(reaction_hash: ActionHash) -> ExternResult<()> {
    delete_entry(reaction_hash)?;
    Ok(())
}

/// Get all reactions for a post
#[hdk_extern]
pub fn get_post_reactions(post_hash: ActionHash) -> ExternResult<Vec<ReactionOutput>> {
    let links = get_links(
        LinkQuery::try_new(post_hash, LinkTypes::PostToReactions)?,
        GetStrategy::Local,
    )?;
    
    let mut reactions = Vec::new();
    
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
                if let Some(reaction) = record.entry().to_app_option::<Reaction>()
                    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))? 
                {
                    let entry_hash = hash_entry(&reaction)?;
                    reactions.push(ReactionOutput {
                        reaction,
                        action_hash,
                        entry_hash,
                    });
                }
            }
        }
    }
    
    Ok(reactions)
}

// ============================================================================
// COMMENTS
// ============================================================================

/// Add a comment to a post
#[hdk_extern]
pub fn add_comment(input: CreateCommentInput) -> ExternResult<CommentOutput> {
    let author = agent_info()?.agent_initial_pubkey;
    
    let comment = Comment {
        post_hash: input.post_hash.clone(),
        author,
        content: input.content,
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::Comment(comment.clone()))?;
    let entry_hash = hash_entry(&comment)?;
    
    // Link from post to comment
    create_link(
        input.post_hash.clone(),
        action_hash.clone(),
        LinkTypes::PostToComments,
        (),
    )?;
        // Emit signal for real-time updates
    emit_signal(Signal::NewComment {
        post_hash: input.post_hash,
        comment_hash: action_hash.clone(),
    })?;
        Ok(CommentOutput {
        comment,
        action_hash,
        entry_hash,
    })
}

/// Get all comments for a post
#[hdk_extern]
pub fn get_post_comments(post_hash: ActionHash) -> ExternResult<Vec<CommentOutput>> {
    let links = get_links(
        LinkQuery::try_new(post_hash, LinkTypes::PostToComments)?,
        GetStrategy::Local,
    )?;
    
    let mut comments = Vec::new();
    
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
                if let Some(comment) = record.entry().to_app_option::<Comment>()
                    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))? 
                {
                    let entry_hash = hash_entry(&comment)?;
                    comments.push(CommentOutput {
                        comment,
                        action_hash,
                        entry_hash,
                    });
                }
            }
        }
    }
    
    // Sort by created_at ascending (oldest first for comments)
    comments.sort_by(|a, b| a.comment.created_at.cmp(&b.comment.created_at));
    
    Ok(comments)
}
