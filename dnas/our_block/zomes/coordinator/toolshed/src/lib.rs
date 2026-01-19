//! Tool Shed Coordinator Zome
//!
//! This zome implements the business logic for the "Tool Shed" -
//! a shared inventory where neighbors can list and borrow items.
//!
//! ## Borrowing Flow
//!
//! 1. Borrower calls `request_borrow` to create a BorrowRequest
//! 2. Owner sees the request and calls `accept_borrow` to initiate countersigning
//! 3. Both parties sign the Transaction entry
//! 4. Upon successful countersign, item status is updated to Borrowed
//! 5. When returned, `return_item` is called to complete the transaction
//!
//! ## Countersigning
//!
//! The countersigning flow ensures both parties cryptographically agree
//! on the borrow terms before the transaction is committed.

use hdk::prelude::*;
use toolshed_integrity::*;

/// Input for creating an item
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateItemInput {
    pub title: String,
    pub description: String,
    pub image_hash: Option<EntryHash>,
    pub consumables: Vec<Consumable>,
    pub notes: String,
}

/// Output for item operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ItemOutput {
    pub item: Item,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

/// Input for requesting to borrow an item
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RequestBorrowInput {
    pub item_hash: ActionHash,
    pub requested_due_date: Timestamp,
    pub message: Option<String>,
}

/// Output for borrow request
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BorrowRequestOutput {
    pub request: BorrowRequest,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

/// Input for accepting a borrow request
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AcceptBorrowInput {
    pub request_hash: ActionHash,
    pub due_date: Timestamp,
    pub notes: Option<String>,
}

/// Output for transaction operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TransactionOutput {
    pub transaction: Transaction,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
    pub status: TransactionStatus,
}

/// Anchor paths
const ALL_ITEMS_PATH: &str = "all_items";

// ============================================================================
// ITEM MANAGEMENT
// ============================================================================

/// Create a new item in the Tool Shed
#[hdk_extern]
pub fn create_item(input: CreateItemInput) -> ExternResult<ItemOutput> {
    let owner = agent_info()?.agent_initial_pubkey;
    
    let item = Item {
        title: input.title,
        description: input.description,
        image_hash: input.image_hash,
        consumables: input.consumables,
        notes: input.notes,
        owner: owner.clone(),
        status: ItemStatus::Available,
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::Item(item.clone()))?;
    let entry_hash = hash_entry(&item)?;
    
    // Link from owner to item
    create_link(
        owner,
        action_hash.clone(),
        LinkTypes::AgentToItems,
        (),
    )?;
    
    // Link to all items
    let all_items_anchor = all_items_anchor_hash()?;
    create_link(
        all_items_anchor,
        action_hash.clone(),
        LinkTypes::AllItems,
        (),
    )?;
    
    Ok(ItemOutput {
        item,
        action_hash,
        entry_hash,
    })
}

/// Get all items in the Tool Shed
#[hdk_extern]
pub fn get_all_items(_: ()) -> ExternResult<Vec<ItemOutput>> {
    let all_items_anchor = all_items_anchor_hash()?;
    let links = get_links(
        LinkQuery::try_new(all_items_anchor, LinkTypes::AllItems)?,
        GetStrategy::Local,
    )?;
    
    let mut items = Vec::new();
    
    for link in links {
        let action_hash = ActionHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid action hash".to_string()))
        })?;
        
        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(item) = record
                .entry()
                .to_app_option::<Item>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&item)?;
                items.push(ItemOutput {
                    item,
                    action_hash,
                    entry_hash,
                });
            }
        }
    }
    
    Ok(items)
}

/// Get items owned by an agent
#[hdk_extern]
pub fn get_my_items(_: ()) -> ExternResult<Vec<ItemOutput>> {
    let owner = agent_info()?.agent_initial_pubkey;
    get_items_for_owner(owner)
}

/// Get items owned by a specific agent
#[hdk_extern]
pub fn get_items_for_owner(owner: AgentPubKey) -> ExternResult<Vec<ItemOutput>> {
    let links = get_links(
        LinkQuery::try_new(owner, LinkTypes::AgentToItems)?,
        GetStrategy::Local,
    )?;
    
    let mut items = Vec::new();
    
    for link in links {
        let action_hash = ActionHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid action hash".to_string()))
        })?;
        
        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(item) = record
                .entry()
                .to_app_option::<Item>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&item)?;
                items.push(ItemOutput {
                    item,
                    action_hash,
                    entry_hash,
                });
            }
        }
    }
    
    Ok(items)
}

/// Get a single item by hash
#[hdk_extern]
pub fn get_item(action_hash: ActionHash) -> ExternResult<Option<ItemOutput>> {
    let Some(record) = get(action_hash.clone(), GetOptions::default())? else {
        return Ok(None);
    };
    
    let Some(item) = record
        .entry()
        .to_app_option::<Item>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Ok(None);
    };
    
    let entry_hash = hash_entry(&item)?;
    
    Ok(Some(ItemOutput {
        item,
        action_hash,
        entry_hash,
    }))
}

/// Input for updating item status
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateStatusInput {
    pub action_hash: ActionHash,
    pub status: ItemStatus,
}

/// Update item status (owner only)
#[hdk_extern]
pub fn update_item_status(input: UpdateStatusInput) -> ExternResult<ItemOutput> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    let Some(record) = get(input.action_hash.clone(), GetOptions::default())? else {
        return Err(wasm_error!(WasmErrorInner::Guest("Item not found".to_string())));
    };
    
    let Some(mut item) = record
        .entry()
        .to_app_option::<Item>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Err(wasm_error!(WasmErrorInner::Guest("Invalid item entry".to_string())));
    };
    
    // Verify ownership
    if item.owner != agent {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Only the owner can update item status".to_string()
        )));
    }
    
    item.status = input.status;
    
    let new_action_hash = update_entry(input.action_hash, &item)?;
    let entry_hash = hash_entry(&item)?;
    
    Ok(ItemOutput {
        item,
        action_hash: new_action_hash,
        entry_hash,
    })
}

/// Input for updating an item
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateItemInput {
    pub action_hash: ActionHash,
    pub title: String,
    pub description: String,
}

/// Update item details (owner only)
#[hdk_extern]
pub fn update_item(input: UpdateItemInput) -> ExternResult<ItemOutput> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    let Some(record) = get(input.action_hash.clone(), GetOptions::default())? else {
        return Err(wasm_error!(WasmErrorInner::Guest("Item not found".to_string())));
    };
    
    let Some(mut item) = record
        .entry()
        .to_app_option::<Item>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Err(wasm_error!(WasmErrorInner::Guest("Invalid item entry".to_string())));
    };
    
    // Verify ownership
    if item.owner != agent {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Only the owner can update item details".to_string()
        )));
    }
    
    item.title = input.title;
    item.description = input.description;
    
    let new_action_hash = update_entry(input.action_hash, &item)?;
    let entry_hash = hash_entry(&item)?;
    
    Ok(ItemOutput {
        item,
        action_hash: new_action_hash,
        entry_hash,
    })
}

// ============================================================================
// BORROW REQUEST FLOW
// ============================================================================

/// Request to borrow an item
/// 
/// Creates a BorrowRequest entry that the owner can see and respond to.
#[hdk_extern]
pub fn request_borrow(input: RequestBorrowInput) -> ExternResult<BorrowRequestOutput> {
    let requester = agent_info()?.agent_initial_pubkey;
    
    // Get the item to verify it exists and get the owner
    let Some(item_output) = get_item(input.item_hash.clone())? else {
        return Err(wasm_error!(WasmErrorInner::Guest("Item not found".to_string())));
    };
    
    // Cannot borrow your own item
    if item_output.item.owner == requester {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Cannot request to borrow your own item".to_string()
        )));
    }
    
    // Check if item is available
    if item_output.item.status != ItemStatus::Available {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Item is not available for borrowing".to_string()
        )));
    }
    
    let request = BorrowRequest {
        item_hash: input.item_hash.clone(),
        requester: requester.clone(),
        owner: item_output.item.owner.clone(),
        requested_due_date: input.requested_due_date,
        message: input.message,
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::BorrowRequest(request.clone()))?;
    let entry_hash = hash_entry(&request)?;
    
    // Link from item to request
    create_link(
        input.item_hash,
        action_hash.clone(),
        LinkTypes::ItemToBorrowRequests,
        (),
    )?;
    
    // Link from requester to request
    create_link(
        requester,
        action_hash.clone(),
        LinkTypes::AgentToBorrowRequests,
        (),
    )?;
    
    Ok(BorrowRequestOutput {
        request,
        action_hash,
        entry_hash,
    })
}

/// Get borrow requests for an item (owner use)
#[hdk_extern]
pub fn get_borrow_requests_for_item(item_hash: ActionHash) -> ExternResult<Vec<BorrowRequestOutput>> {
    let links = get_links(
        LinkQuery::try_new(item_hash, LinkTypes::ItemToBorrowRequests)?,
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
                .to_app_option::<BorrowRequest>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&request)?;
                requests.push(BorrowRequestOutput {
                    request,
                    action_hash,
                    entry_hash,
                });
            }
        }
    }
    
    Ok(requests)
}

/// Get my outgoing borrow requests
#[hdk_extern]
pub fn get_my_borrow_requests(_: ()) -> ExternResult<Vec<BorrowRequestOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    let links = get_links(
        LinkQuery::try_new(agent, LinkTypes::AgentToBorrowRequests)?,
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
                .to_app_option::<BorrowRequest>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&request)?;
                requests.push(BorrowRequestOutput {
                    request,
                    action_hash,
                    entry_hash,
                });
            }
        }
    }
    
    Ok(requests)
}

// ============================================================================
// COUNTERSIGNING BORROW FLOW
// ============================================================================

/// Accept a borrow request and create a transaction
///
/// This function is called by the item owner to accept a borrow request.
/// In a full countersigning implementation, this would:
/// 1. Create a preflight request
/// 2. Both parties sign
/// 3. Commit the countersigned entry
///
/// For now, we implement a simplified version that creates the transaction
/// as a regular entry. True countersigning requires the unstable features
/// and a more complex session management flow.
#[hdk_extern]
pub fn accept_borrow(input: AcceptBorrowInput) -> ExternResult<TransactionOutput> {
    let lender = agent_info()?.agent_initial_pubkey;
    
    // Get the borrow request
    let Some(record) = get(input.request_hash.clone(), GetOptions::default())? else {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Borrow request not found".to_string()
        )));
    };
    
    let Some(request) = record
        .entry()
        .to_app_option::<BorrowRequest>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Invalid borrow request".to_string()
        )));
    };
    
    // Verify the caller is the item owner
    if request.owner != lender {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Only the item owner can accept borrow requests".to_string()
        )));
    }
    
    // Get the item to verify it's still available
    let Some(item_output) = get_item(request.item_hash.clone())? else {
        return Err(wasm_error!(WasmErrorInner::Guest("Item not found".to_string())));
    };
    
    if item_output.item.status != ItemStatus::Available {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Item is no longer available".to_string()
        )));
    }
    
    let now = sys_time()?;
    
    // Create the transaction
    let transaction = Transaction {
        item_hash: request.item_hash.clone(),
        borrower: request.requester.clone(),
        lender: lender.clone(),
        due_date: input.due_date,
        created_at: now,
        notes: input.notes,
    };
    
    let txn_action_hash = create_entry(EntryTypes::Transaction(transaction.clone()))?;
    let txn_entry_hash = hash_entry(&transaction)?;
    
    // Create transaction record with Active status
    let txn_record = TransactionRecord {
        transaction_hash: txn_action_hash.clone(),
        returned_at: None,
        status: TransactionStatus::Active,
    };
    
    create_entry(EntryTypes::TransactionRecord(txn_record))?;
    
    // Link transaction to both agents
    create_link(
        lender.clone(),
        txn_action_hash.clone(),
        LinkTypes::AgentToTransactions,
        (),
    )?;
    
    create_link(
        request.requester.clone(),
        txn_action_hash.clone(),
        LinkTypes::AgentToTransactions,
        (),
    )?;
    
    // Update item status to Borrowed
    update_item_status(UpdateStatusInput {
        action_hash: item_output.action_hash,
        status: ItemStatus::Borrowed,
    })?;
    
    // Delete the borrow request link (request is now fulfilled)
    let request_links = get_links(
        LinkQuery::try_new(request.item_hash.clone(), LinkTypes::ItemToBorrowRequests)?,
        GetStrategy::Local,
    )?;
    
    for link in request_links {
        if ActionHash::try_from(link.target.clone()).ok() == Some(input.request_hash.clone()) {
            delete_link(link.create_link_hash, GetOptions::default())?;
        }
    }
    
    Ok(TransactionOutput {
        transaction,
        action_hash: txn_action_hash,
        entry_hash: txn_entry_hash,
        status: TransactionStatus::Active,
    })
}

/// Mark an item as returned
#[hdk_extern]
pub fn return_item(transaction_hash: ActionHash) -> ExternResult<TransactionOutput> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    // Get the transaction
    let Some(record) = get(transaction_hash.clone(), GetOptions::default())? else {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Transaction not found".to_string()
        )));
    };
    
    let Some(transaction) = record
        .entry()
        .to_app_option::<Transaction>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Invalid transaction".to_string()
        )));
    };
    
    // Either borrower or lender can mark as returned
    if agent != transaction.borrower && agent != transaction.lender {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Only the borrower or lender can mark an item as returned".to_string()
        )));
    }
    
    // Update item status back to Available
    if let Some(item_output) = get_item(transaction.item_hash.clone())? {
        update_item_status(UpdateStatusInput {
            action_hash: item_output.action_hash,
            status: ItemStatus::Available,
        })?;
    }
    
    // Create updated transaction record
    let txn_record = TransactionRecord {
        transaction_hash: transaction_hash.clone(),
        returned_at: Some(sys_time()?),
        status: TransactionStatus::Returned,
    };
    
    create_entry(EntryTypes::TransactionRecord(txn_record))?;
    
    let entry_hash = hash_entry(&transaction)?;
    
    Ok(TransactionOutput {
        transaction,
        action_hash: transaction_hash,
        entry_hash,
        status: TransactionStatus::Returned,
    })
}

/// Get my transactions (as borrower or lender)
#[hdk_extern]
pub fn get_my_transactions(_: ()) -> ExternResult<Vec<TransactionOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    let links = get_links(
        LinkQuery::try_new(agent, LinkTypes::AgentToTransactions)?,
        GetStrategy::Local,
    )?;
    
    let mut transactions = Vec::new();
    
    for link in links {
        let action_hash = ActionHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid action hash".to_string()))
        })?;
        
        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(transaction) = record
                .entry()
                .to_app_option::<Transaction>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                let entry_hash = hash_entry(&transaction)?;
                // TODO: Get actual status from TransactionRecord
                transactions.push(TransactionOutput {
                    transaction,
                    action_hash,
                    entry_hash,
                    status: TransactionStatus::Active,
                });
            }
        }
    }
    
    Ok(transactions)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn all_items_anchor_hash() -> ExternResult<EntryHash> {
    let path = Path::from(ALL_ITEMS_PATH);
    path.path_entry_hash()
}
