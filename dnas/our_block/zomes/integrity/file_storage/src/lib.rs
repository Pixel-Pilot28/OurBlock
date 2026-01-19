use hdi::prelude::*;

/// File metadata stored in the DHT
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct FileMetadata {
    pub name: String,
    pub size: u32,
    pub file_type: String,
    pub hash: String, // SHA-256 hash of file content
    pub chunks: Vec<ActionHash>, // References to file chunks
    pub author: AgentPubKey,
    pub created_at: Timestamp,
}

/// A chunk of file data (max ~4MB per chunk for DHT efficiency)
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct FileChunk {
    pub file_hash: ActionHash, // Reference to parent FileMetadata
    pub chunk_index: u32,
    #[serde(with = "serde_bytes")]
    pub data: Vec<u8>,
}

pub const MAX_FILE_NAME_LENGTH: usize = 255;
pub const MAX_FILE_TYPE_LENGTH: usize = 100;
pub const MAX_CHUNK_SIZE: usize = 4_000_000; // ~4MB
pub const MAX_FILE_CHUNKS: usize = 100; // Max ~400MB per file

#[hdk_link_types]
pub enum LinkTypes {
    AllFiles,
    AgentToFiles,
    FileToChunks,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "file_metadata", visibility = "public")]
    FileMetadata(FileMetadata),
    #[entry_type(name = "file_chunk", visibility = "public")]
    FileChunk(FileChunk),
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::FileMetadata(metadata) => validate_file_metadata(metadata, action.author.clone()),
                EntryTypes::FileChunk(chunk) => validate_file_chunk(chunk),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::FileMetadata(metadata) => validate_file_metadata(metadata, action.author.clone()),
                EntryTypes::FileChunk(chunk) => validate_file_chunk(chunk),
            },
            OpRecord::DeleteEntry { original_action_hash, action, .. } => {
                let original_record = must_get_valid_record(original_action_hash)?;
                let original_action = original_record.action().clone();
                let original_action = match original_action {
                    Action::Create(create) => create,
                    _ => return Ok(ValidateCallbackResult::Invalid("Original action must be Create".into())),
                };
                if action.author != original_action.author {
                    return Ok(ValidateCallbackResult::Invalid("Only the author can delete their file".into()));
                }
                Ok(ValidateCallbackResult::Valid)
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

fn validate_file_metadata(metadata: FileMetadata, author: AgentPubKey) -> ExternResult<ValidateCallbackResult> {
    if metadata.name.is_empty() {
        return Ok(ValidateCallbackResult::Invalid("File name cannot be empty".into()));
    }
    if metadata.name.len() > MAX_FILE_NAME_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "File name cannot exceed {} characters", MAX_FILE_NAME_LENGTH
        )));
    }
    if metadata.file_type.len() > MAX_FILE_TYPE_LENGTH {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "File type cannot exceed {} characters", MAX_FILE_TYPE_LENGTH
        )));
    }
    if metadata.chunks.is_empty() {
        return Ok(ValidateCallbackResult::Invalid("File must have at least one chunk".into()));
    }
    if metadata.chunks.len() > MAX_FILE_CHUNKS {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "File cannot exceed {} chunks", MAX_FILE_CHUNKS
        )));
    }
    if metadata.author != author {
        return Ok(ValidateCallbackResult::Invalid("File author must match action author".into()));
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_file_chunk(chunk: FileChunk) -> ExternResult<ValidateCallbackResult> {
    if chunk.data.is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Chunk data cannot be empty".into()));
    }
    if chunk.data.len() > MAX_CHUNK_SIZE {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Chunk size cannot exceed {} bytes", MAX_CHUNK_SIZE
        )));
    }
    Ok(ValidateCallbackResult::Valid)
}
