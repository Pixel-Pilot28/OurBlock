use hdk::prelude::*;
use helpinghands_integrity::*;

/// ───────────────────────────────────────────────────────────────────────────
/// ANCHOR HELPERS
/// ───────────────────────────────────────────────────────────────────────────

fn all_requests_anchor() -> ExternResult<EntryHash> {
    // Use a placeholder Request as anchor base
    let anchor = Request {
        title: "ANCHOR".to_string(),
        category: RequestCategory::Other { description: "anchor".to_string() },
        urgency: Urgency::Low,
        description: "Anchor entry for all requests".to_string(),
        author: AgentPubKey::from_raw_36(vec![0u8; 36]),
        created_at: Timestamp::from_micros(0),
        is_fulfilled: false,
    };
    hash_entry(&anchor)
}

/// ───────────────────────────────────────────────────────────────────────────
/// REQUEST INPUT/OUTPUT TYPES
/// ───────────────────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateRequestInput {
    pub title: String,
    pub category: RequestCategory,
    pub urgency: Urgency,
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RequestOutput {
    pub request: Request,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
    pub comment_count: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateCommentInput {
    pub request_hash: ActionHash,
    pub content: String,
    pub is_offer: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CommentOutput {
    pub comment: Comment,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

/// ───────────────────────────────────────────────────────────────────────────
/// REQUEST FUNCTIONS
/// ───────────────────────────────────────────────────────────────────────────

/// Create a new mutual aid request
#[hdk_extern]
pub fn create_request(input: CreateRequestInput) -> ExternResult<RequestOutput> {
    let agent = agent_info()?.agent_initial_pubkey;
    let now = sys_time()?;

    let request = Request {
        title: input.title,
        category: input.category,
        urgency: input.urgency,
        description: input.description,
        author: agent.clone(),
        created_at: now,
        is_fulfilled: false,
    };

    let action_hash = create_entry(EntryTypes::Request(request.clone()))?;
    let entry_hash = hash_entry(&request)?;

    // Link from all_requests anchor
    let anchor = all_requests_anchor()?;
    create_link(
        anchor,
        action_hash.clone(),
        LinkTypes::AllRequests,
        (),
    )?;

    // Link from agent to their request
    create_link(
        agent,
        action_hash.clone(),
        LinkTypes::AgentToRequests,
        (),
    )?;

    Ok(RequestOutput {
        request,
        action_hash,
        entry_hash,
        comment_count: 0,
    })
}

/// Get all mutual aid requests
#[hdk_extern]
pub fn get_all_requests(_: ()) -> ExternResult<Vec<RequestOutput>> {
    let anchor = all_requests_anchor()?;
    let links = get_links(
        LinkQuery::try_new(anchor, LinkTypes::AllRequests)?,
        GetStrategy::Local,
    )?;
    
    let mut requests = Vec::new();
    
    for link in links {
        let action_hash = ActionHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid action hash".to_string()))
        })?;
        
        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(request) = record
                .entry()
                .to_app_option::<Request>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&request)?;
                let comment_count = get_comment_count(action_hash.clone())?;
                
                requests.push(RequestOutput {
                    request,
                    action_hash,
                    entry_hash,
                    comment_count,
                });
            }
        }
    }
    
    // Sort by urgency (Emergency first) then by created_at (newest first)
    requests.sort_by(|a, b| {
        let urgency_order = |u: &Urgency| match u {
            Urgency::Emergency => 0,
            Urgency::High => 1,
            Urgency::Low => 2,
        };
        
        match urgency_order(&a.request.urgency).cmp(&urgency_order(&b.request.urgency)) {
            std::cmp::Ordering::Equal => b.request.created_at.cmp(&a.request.created_at),
            other => other,
        }
    });
    
    Ok(requests)
}

/// Get my requests
#[hdk_extern]
pub fn get_my_requests(_: ()) -> ExternResult<Vec<RequestOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    let links = get_links(
        LinkQuery::try_new(agent, LinkTypes::AgentToRequests)?,
        GetStrategy::Local,
    )?;
    
    let mut requests = Vec::new();
    
    for link in links {
        let action_hash = ActionHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid action hash".to_string()))
        })?;
        
        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(request) = record
                .entry()
                .to_app_option::<Request>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&request)?;
                let comment_count = get_comment_count(action_hash.clone())?;
                
                requests.push(RequestOutput {
                    request,
                    action_hash,
                    entry_hash,
                    comment_count,
                });
            }
        }
    }
    
    Ok(requests)
}

/// Get a single request by hash
#[hdk_extern]
pub fn get_request(action_hash: ActionHash) -> ExternResult<Option<RequestOutput>> {
    let Some(record) = get(action_hash.clone(), GetOptions::default())? else {
        return Ok(None);
    };
    
    let Some(request) = record
        .entry()
        .to_app_option::<Request>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Ok(None);
    };
    
    let entry_hash = hash_entry(&request)?;
    let comment_count = get_comment_count(action_hash.clone())?;
    
    Ok(Some(RequestOutput {
        request,
        action_hash,
        entry_hash,
        comment_count,
    }))
}

/// Mark a request as fulfilled
#[hdk_extern]
pub fn fulfill_request(action_hash: ActionHash) -> ExternResult<RequestOutput> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    let Some(record) = get(action_hash.clone(), GetOptions::default())? else {
        return Err(wasm_error!(WasmErrorInner::Guest("Request not found".to_string())));
    };
    
    let Some(mut request) = record
        .entry()
        .to_app_option::<Request>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Err(wasm_error!(WasmErrorInner::Guest("Invalid request".to_string())));
    };
    
    // Only the author can mark as fulfilled
    if request.author != agent {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Only the request author can mark it as fulfilled".to_string()
        )));
    }
    
    request.is_fulfilled = true;
    
    let new_action_hash = update_entry(action_hash.clone(), &request)?;
    let entry_hash = hash_entry(&request)?;
    let comment_count = get_comment_count(action_hash)?;
    
    Ok(RequestOutput {
        request,
        action_hash: new_action_hash,
        entry_hash,
        comment_count,
    })
}

/// ───────────────────────────────────────────────────────────────────────────
/// COMMENT FUNCTIONS
/// ───────────────────────────────────────────────────────────────────────────

/// Add a comment or offer to a request
#[hdk_extern]
pub fn create_comment(input: CreateCommentInput) -> ExternResult<CommentOutput> {
    let agent = agent_info()?.agent_initial_pubkey;
    let now = sys_time()?;
    
    let comment = Comment {
        request_hash: input.request_hash.clone(),
        author: agent,
        content: input.content,
        is_offer: input.is_offer,
        created_at: now,
    };
    
    let action_hash = create_entry(EntryTypes::Comment(comment.clone()))?;
    let entry_hash = hash_entry(&comment)?;
    
    // Link comment to request
    create_link(
        input.request_hash,
        action_hash.clone(),
        LinkTypes::RequestToComments,
        (),
    )?;
    
    Ok(CommentOutput {
        comment,
        action_hash,
        entry_hash,
    })
}

/// Get comments for a request
#[hdk_extern]
pub fn get_comments_for_request(request_hash: ActionHash) -> ExternResult<Vec<CommentOutput>> {
    let links = get_links(
        LinkQuery::try_new(request_hash, LinkTypes::RequestToComments)?,
        GetStrategy::Local,
    )?;
    
    let mut comments = Vec::new();
    
    for link in links {
        let action_hash = ActionHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid action hash".to_string()))
        })?;
        
        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(comment) = record
                .entry()
                .to_app_option::<Comment>()
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
    
    // Sort by created_at (oldest first)
    comments.sort_by(|a, b| a.comment.created_at.cmp(&b.comment.created_at));
    
    Ok(comments)
}

/// Helper to count comments for a request
fn get_comment_count(request_hash: ActionHash) -> ExternResult<usize> {
    let links = get_links(
        LinkQuery::try_new(request_hash, LinkTypes::RequestToComments)?,
        GetStrategy::Local,
    )?;
    Ok(links.len())
}

/// ───────────────────────────────────────────────────────────────────────────
/// UTILITY FUNCTIONS
/// ───────────────────────────────────────────────────────────────────────────

/// Get my agent public key
#[hdk_extern]
pub fn get_my_agent_key(_: ()) -> ExternResult<AgentPubKey> {
    Ok(agent_info()?.agent_initial_pubkey)
}
