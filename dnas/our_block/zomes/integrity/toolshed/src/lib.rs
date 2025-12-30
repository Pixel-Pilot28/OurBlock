use hdi::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ItemStatus {
    Available,
    Borrowed,
    Unavailable,
}

impl Default for ItemStatus {
    fn default() -> Self { ItemStatus::Available }
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Item {
    pub title: String,
    pub description: String,
    pub image_hash: Option<EntryHash>,
    pub owner: AgentPubKey,
    pub status: ItemStatus,
    pub created_at: Timestamp,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct BorrowRequest {
    pub item_hash: ActionHash,
    pub requester: AgentPubKey,
    pub owner: AgentPubKey,
    pub requested_due_date: Timestamp,
    pub message: Option<String>,
    pub created_at: Timestamp,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Transaction {
    pub item_hash: ActionHash,
    pub borrower: AgentPubKey,
    pub lender: AgentPubKey,
    pub due_date: Timestamp,
    pub created_at: Timestamp,
    pub notes: Option<String>,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct TransactionRecord {
    pub transaction_hash: ActionHash,
    pub returned_at: Option<Timestamp>,
    pub status: TransactionStatus,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TransactionStatus {
    Pending,
    Active,
    Returned,
    Cancelled,
}

pub const MAX_TITLE_LENGTH: usize = 100;
pub const MAX_DESCRIPTION_LENGTH: usize = 1000;
pub const MAX_MESSAGE_LENGTH: usize = 500;

#[hdk_link_types]
pub enum LinkTypes {
    AllItems,
    AgentToItems,
    ItemToBorrowRequests,
    AgentToTransactions,
    AgentToBorrowRequests,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "item", visibility = "public")]
    Item(Item),
    #[entry_type(name = "borrow_request", visibility = "public")]
    BorrowRequest(BorrowRequest),
    #[entry_type(name = "transaction", visibility = "public")]
    Transaction(Transaction),
    #[entry_type(name = "transaction_record", visibility = "public")]
    TransactionRecord(TransactionRecord),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Item(item) => validate_item(item, action.author.clone()),
                EntryTypes::BorrowRequest(req) => validate_borrow_request(req, action.author.clone()),
                EntryTypes::Transaction(txn) => validate_transaction(txn),
                EntryTypes::TransactionRecord(_) => Ok(ValidateCallbackResult::Valid),
            },
            OpEntry::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Item(item) => validate_item(item, action.author.clone()),
                _ => Ok(ValidateCallbackResult::Valid),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::Item(item) => validate_item(item, action.author.clone()),
                EntryTypes::BorrowRequest(req) => validate_borrow_request(req, action.author.clone()),
                EntryTypes::Transaction(txn) => validate_transaction(txn),
                EntryTypes::TransactionRecord(_) => Ok(ValidateCallbackResult::Valid),
            },
            OpRecord::UpdateEntry { app_entry, action, .. } => match app_entry {
                EntryTypes::Item(item) => validate_item(item, action.author.clone()),
                _ => Ok(ValidateCallbackResult::Valid),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_item(item: Item, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if item.title.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Item title cannot be empty".into()));
    }
    if item.title.len() > MAX_TITLE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!("Title cannot exceed {} chars", MAX_TITLE_LENGTH)));
    }
    if item.description.len() > MAX_DESCRIPTION_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!("Description cannot exceed {} chars", MAX_DESCRIPTION_LENGTH)));
    }
    if item.owner != author {
        return Ok(ValidateCallbackResult::Invalid("Item owner must match author".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_borrow_request(req: BorrowRequest, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if req.requester != author {
        return Ok(ValidateCallbackResult::Invalid("Requester must match author".into()));
    }
    if req.requester == req.owner {
        return Ok(ValidateCallbackResult::Invalid("Cannot borrow your own item".into()));
    }
    if let Some(ref msg) = req.message {
        if msg.len() > MAX_MESSAGE_LENGTH {
            return Ok(ValidateCallbackResult::Invalid(format!("Message cannot exceed {} chars", MAX_MESSAGE_LENGTH)));
        }
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_transaction(txn: Transaction) -> ExternResult<ValidateCallbackResult> {
    if txn.borrower == txn.lender {
        return Ok(ValidateCallbackResult::Invalid("Borrower and lender cannot be the same".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}
