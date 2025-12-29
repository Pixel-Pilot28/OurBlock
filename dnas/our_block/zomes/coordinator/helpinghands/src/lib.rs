use hdk::prelude::*;
use helpinghands_integrity::*;

/// ───────────────────────────────────────────────────────────────────────────
/// ANCHOR HELPERS
/// ───────────────────────────────────────────────────────────────────────────

fn all_requests_anchor() -> ExternResult<EntryHash> {
    let anchor_bytes = "all_requests".as_bytes().to_vec();
    hash_entry(&anchor_bytes)
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
    let agent = agent_info()?.agent_latest_pubkey;
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
        GetLinksInputBuilder::try_new(anchor, LinkTypes::AllRequests)?.build(),
    )?;

    let mut requests: Vec<RequestOutput> = Vec::new();

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
                
                // Get comment count
                let comment_links = get_links(
                    GetLinksInputBuilder::try_new(action_hash.clone(), LinkTypes::RequestToComments)?
                        .build(),
                )?;

                requests.push(RequestOutput {
                    request,
                    action_hash,
                    entry_hash,
                    comment_count: comment_links.len(),
                });
            }
        }
    }

    // Sort by urgency (Emergency first) then by creation time (newest first)
    requests.sort_by(|a, b| {
        let urgency_order = |u: &Urgency| match u {
            Urgency::Emergency => 0,
            Urgency::High => 1,
            Urgency::Low => 2,
        };
        
        let urgency_cmp = urgency_order(&a.request.urgency)
            .cmp(&urgency_order(&b.request.urgency));
        
        if urgency_cmp == std::cmp::Ordering::Equal {
            b.request.created_at.cmp(&a.request.created_at)
        } else {
            urgency_cmp
        }
    });

    Ok(requests)
}

/// Get requests by category
#[hdk_extern]
pub fn get_requests_by_category(category: RequestCategory) -> ExternResult<Vec<RequestOutput>> {
    let all = get_all_requests(())?;
    
    Ok(all
        .into_iter()
        .filter(|r| {
            match (&r.request.category, &category) {
                (RequestCategory::Other { .. }, RequestCategory::Other { .. }) => true,
                (a, b) => std::mem::discriminant(a) == std::mem::discriminant(b),
            }
        })
        .collect())
}

/// Get requests by urgency
#[hdk_extern]
pub fn get_requests_by_urgency(urgency: Urgency) -> ExternResult<Vec<RequestOutput>> {
    let all = get_all_requests(())?;
    
    Ok(all
        .into_iter()
        .filter(|r| r.request.urgency == urgency)
        .collect())
}

/// Get my requests
#[hdk_extern]
pub fn get_my_requests(_: ()) -> ExternResult<Vec<RequestOutput>> {
    let agent = agent_info()?.agent_latest_pubkey;
    let links = get_links(
        GetLinksInputBuilder::try_new(agent, LinkTypes::AgentToRequests)?.build(),
    )?;

    let mut requests: Vec<RequestOutput> = Vec::new();

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
                
                let comment_links = get_links(
                    GetLinksInputBuilder::try_new(action_hash.clone(), LinkTypes::RequestToComments)?
                        .build(),
                )?;

                requests.push(RequestOutput {
                    request,
                    action_hash,
                    entry_hash,
                    comment_count: comment_links.len(),
                });
            }
        }
    }

    requests.sort_by(|a, b| b.request.created_at.cmp(&a.request.created_at));
    Ok(requests)
}

/// Get a single request by hash
#[hdk_extern]
pub fn get_request(action_hash: ActionHash) -> ExternResult<Option<RequestOutput>> {
    if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
        if let Some(request) = record
            .entry()
            .to_app_option::<Request>()
            .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
        {
            let entry_hash = hash_entry(&request)?;
            
            let comment_links = get_links(
                GetLinksInputBuilder::try_new(action_hash.clone(), LinkTypes::RequestToComments)?
                    .build(),
            )?;

            return Ok(Some(RequestOutput {
                request,
                action_hash,
                entry_hash,
                comment_count: comment_links.len(),
            }));
        }
    }
    Ok(None)
}

/// Mark a request as fulfilled
#[hdk_extern]
pub fn fulfill_request(action_hash: ActionHash) -> ExternResult<RequestOutput> {
    let record = get(action_hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest("Request not found".to_string())))?;

    let mut request = record
        .entry()
        .to_app_option::<Request>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
        .ok_or(wasm_error!(WasmErrorInner::Guest("Invalid request entry".to_string())))?;

    let agent = agent_info()?.agent_latest_pubkey;
    if request.author != agent {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Only the request author can mark it as fulfilled".to_string()
        )));
    }

    request.is_fulfilled = true;

    let new_action_hash = update_entry(action_hash, &request)?;
    let entry_hash = hash_entry(&request)?;

    let comment_links = get_links(
        GetLinksInputBuilder::try_new(new_action_hash.clone(), LinkTypes::RequestToComments)?
            .build(),
    )?;

    Ok(RequestOutput {
        request,
        action_hash: new_action_hash,
        entry_hash,
        comment_count: comment_links.len(),
    })
}

/// ───────────────────────────────────────────────────────────────────────────
/// COMMENT FUNCTIONS
/// ───────────────────────────────────────────────────────────────────────────

/// Add a comment to a request
#[hdk_extern]
pub fn create_comment(input: CreateCommentInput) -> ExternResult<CommentOutput> {
    // Verify the request exists
    let _request = get(input.request_hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest("Request not found".to_string())))?;

    let agent = agent_info()?.agent_latest_pubkey;
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

    // Link from request to comment
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

/// Get all comments for a request
#[hdk_extern]
pub fn get_comments_for_request(request_hash: ActionHash) -> ExternResult<Vec<CommentOutput>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(request_hash, LinkTypes::RequestToComments)?.build(),
    )?;

    let mut comments: Vec<CommentOutput> = Vec::new();

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

    // Sort by creation time (oldest first for comments)
    comments.sort_by(|a, b| a.comment.created_at.cmp(&b.comment.created_at));
    
    Ok(comments)
}

/// Get offers (comments marked as offers) for a request
#[hdk_extern]
pub fn get_offers_for_request(request_hash: ActionHash) -> ExternResult<Vec<CommentOutput>> {
    let comments = get_comments_for_request(request_hash)?;
    Ok(comments.into_iter().filter(|c| c.comment.is_offer).collect())
}
