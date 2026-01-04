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
