//! Tool Shed Integrity Zome
//!
//! This zome defines the data structures and validation rules for the
//! "Tool Shed" - a shared inventory of items that neighbors can borrow.
//!
//! ## Countersigning
//!
//! Borrowing an item requires a countersigned Transaction entry.
//! This ensures both the lender and borrower cryptographically agree
//! on the terms of the borrow before it's committed to either chain.

use hdi::prelude::*;

/// Maximum length for item titles
pub const MAX_TITLE_LENGTH: usize = 100;

/// Maximum length for item descriptions
pub const MAX_DESCRIPTION_LENGTH: usize = 1000;

/// Item status in the Tool Shed
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub enum ItemStatus {
    /// Item is available for borrowing
    Available,
    /// Item is currently borrowed
    Borrowed,
    /// Item is temporarily unavailable (owner's choice)
    Unavailable,
}

impl Default for ItemStatus {
    fn default() -> Self {
        ItemStatus::Available
    }
}

/// An Item in the Tool Shed
///
/// Items are things neighbors can share: ladders, drills, board games, etc.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Item {
    /// Title/name of the item
    pub title: String,
    
    /// Description of the item, condition, any notes
    pub description: String,
    
    /// Optional hash of an image attachment
    pub image_hash: Option<EntryHash>,
    
    /// The owner of the item (who can lend it)
    pub owner: AgentPubKey,
    
    /// Current status
    pub status: ItemStatus,
    
    /// When the item was listed
    pub created_at: Timestamp,
}

/// A Transaction represents a borrow agreement between two neighbors
///
/// This entry is countersigned by both the lender and borrower,
/// creating a cryptographic proof that both parties agreed to the terms.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Transaction {
    /// Hash of the item being borrowed
    pub item_hash: ActionHash,
    
    /// The agent borrowing the item
    pub borrower: AgentPubKey,
    
    /// The agent lending the item (item owner)
    pub lender: AgentPubKey,
    
    /// When the item is due to be returned
    pub due_date: Timestamp,
    
    /// When the transaction was created
    pub created_at: Timestamp,
    
    /// Optional notes about the transaction
    pub notes: Option<String>,
}

/// Transaction status tracking
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub enum TransactionStatus {
    /// Borrow request pending approval
    Pending,
    /// Active borrow (countersigned and in progress)
    Active,
    /// Item has been returned
    Returned,
    /// Transaction was cancelled
    Cancelled,
}

/// A record of a transaction's lifecycle
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct TransactionRecord {
    /// The countersigned transaction
    pub transaction: Transaction,
    
    /// Current status of the transaction
    pub status: TransactionStatus,
    
    /// When status was last updated
    pub updated_at: Timestamp,
}

/// A borrow request (before countersigning)
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct BorrowRequest {
    /// Hash of the item requested
    pub item_hash: ActionHash,
    
    /// The agent requesting to borrow
    pub requester: AgentPubKey,
    
    /// The owner being requested from
    pub owner: AgentPubKey,
    
    /// Requested due date
    pub requested_due_date: Timestamp,
    
    /// Optional message to the owner
    pub message: Option<String>,
    
    /// When the request was made
    pub created_at: Timestamp,
}

/// All entry types in this integrity zome
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "item")]
    Item(Item),
    
    #[entry_type(name = "transaction")]
    Transaction(Transaction),
    
    #[entry_type(name = "transaction_record")]
    TransactionRecord(TransactionRecord),
    
    #[entry_type(name = "borrow_request")]
    BorrowRequest(BorrowRequest),
}

/// Link types for the Tool Shed
#[hdk_link_types]
pub enum LinkTypes {
    /// Links from owner to their items
    OwnerToItems,
    
    /// Links all items for discovery
    AllItems,
    
    /// Links from item to its transactions
    ItemToTransactions,
    
    /// Links from agent to transactions they're part of
    AgentToTransactions,
    
    /// Links from item to pending borrow requests
    ItemToBorrowRequests,
    
    /// Links from agent to their borrow requests
    AgentToBorrowRequests,
}

/// Validates an Item entry
fn validate_item(item: &Item, author: &AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    // Owner must match the author
    if item.owner != *author {
        return Ok(ValidateCallbackResult::Invalid(
            "Item owner must match the action author".to_string(),
        ));
    }
    
    // Validate title
    if item.title.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Item title cannot be empty".to_string(),
        ));
    }
    
    if item.title.len() > MAX_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Item title cannot exceed {} characters",
            MAX_TITLE_LENGTH
        )));
    }
    
    // Validate description
    if item.description.len() > MAX_DESCRIPTION_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Item description cannot exceed {} characters",
            MAX_DESCRIPTION_LENGTH
        )));
    }
    
    Ok(ValidateCallbackResult::Valid)
}

/// Validates a Transaction entry
fn validate_transaction(txn: &Transaction) -> ExternResult<ValidateCallbackResult> {
    // Borrower and lender must be different
    if txn.borrower == txn.lender {
        return Ok(ValidateCallbackResult::Invalid(
            "Cannot borrow from yourself".to_string(),
        ));
    }
    
    // Due date must be in the future (relative to creation)
    if txn.due_date <= txn.created_at {
        return Ok(ValidateCallbackResult::Invalid(
            "Due date must be after the transaction creation time".to_string(),
        ));
    }
    
    Ok(ValidateCallbackResult::Valid)
}

/// Validates a BorrowRequest entry
fn validate_borrow_request(req: &BorrowRequest, author: &AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    // Requester must match author
    if req.requester != *author {
        return Ok(ValidateCallbackResult::Invalid(
            "Borrow request requester must match the action author".to_string(),
        ));
    }
    
    // Cannot request from yourself
    if req.requester == req.owner {
        return Ok(ValidateCallbackResult::Invalid(
            "Cannot request to borrow from yourself".to_string(),
        ));
    }
    
    Ok(ValidateCallbackResult::Valid)
}

/// Main validation callback
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { entry_type, entry } => {
                let author = op.action().author();
                match entry_type {
                    EntryTypes::Item(item) => validate_item(&item, author),
                    EntryTypes::Transaction(txn) => validate_transaction(&txn),
                    EntryTypes::TransactionRecord(_) => Ok(ValidateCallbackResult::Valid),
                    EntryTypes::BorrowRequest(req) => validate_borrow_request(&req, author),
                }
            }
            OpEntry::UpdateEntry { entry_type, entry, .. } => {
                let author = op.action().author();
                match entry_type {
                    EntryTypes::Item(item) => {
                        // Only owner can update
                        if item.owner != *author {
                            return Ok(ValidateCallbackResult::Invalid(
                                "Only the owner can update an item".to_string(),
                            ));
                        }
                        validate_item(&item, author)
                    }
                    EntryTypes::Transaction(_) => Ok(ValidateCallbackResult::Invalid(
                        "Transactions cannot be updated".to_string(),
                    )),
                    EntryTypes::TransactionRecord(_) => Ok(ValidateCallbackResult::Valid),
                    EntryTypes::BorrowRequest(_) => Ok(ValidateCallbackResult::Invalid(
                        "Borrow requests cannot be updated".to_string(),
                    )),
                }
            }
            _ => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { entry_type, entry } => {
                let author = op.action().author();
                match entry_type {
                    EntryTypes::Item(item) => validate_item(&item, author),
                    EntryTypes::Transaction(txn) => validate_transaction(&txn),
                    EntryTypes::TransactionRecord(_) => Ok(ValidateCallbackResult::Valid),
                    EntryTypes::BorrowRequest(req) => validate_borrow_request(&req, author),
                }
            }
            _ => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterCreateLink { link_type, .. } => match link_type {
            LinkTypes::OwnerToItems => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AllItems => Ok(ValidateCallbackResult::Valid),
            LinkTypes::ItemToTransactions => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AgentToTransactions => Ok(ValidateCallbackResult::Valid),
            LinkTypes::ItemToBorrowRequests => Ok(ValidateCallbackResult::Valid),
            LinkTypes::AgentToBorrowRequests => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterDeleteLink { .. } => Ok(ValidateCallbackResult::Valid),

        _ => Ok(ValidateCallbackResult::Valid),
    }
}
