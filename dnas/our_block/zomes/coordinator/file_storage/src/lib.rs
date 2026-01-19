use hdk::prelude::*;
use file_storage_integrity::*;

#[derive(Serialize, Deserialize, Debug)]
pub struct UploadFileInput {
    pub name: String,
    pub file_type: String,
    pub data: Vec<u8>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FileMetadataOutput {
    pub metadata_hash: ActionHash,
    pub metadata: FileMetadata,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FileOutput {
    pub metadata: FileMetadata,
    pub data: Vec<u8>,
}

/// Upload a file by chunking it and storing metadata
#[hdk_extern]
pub fn upload_file(input: UploadFileInput) -> ExternResult<FileMetadataOutput> {
    // Calculate SHA-256 hash of the file
    let hash = format!("{:x}", sha2::Sha256::digest(&input.data));
    
    // Split file into chunks
    let chunk_size = MAX_CHUNK_SIZE;
    let mut chunks = Vec::new();
    let mut chunk_index = 0u32;
    
    for chunk_data in input.data.chunks(chunk_size) {
        let chunk = FileChunk {
            file_hash: ActionHash::from_raw_39(vec![0; 39]), // Placeholder
            chunk_index,
            data: chunk_data.to_vec(),
        };
        
        let chunk_hash = create_entry(EntryTypes::FileChunk(chunk))?;
        chunks.push(chunk_hash);
        chunk_index += 1;
    }
    
    // Create metadata
    let metadata = FileMetadata {
        name: input.name,
        size: input.data.len() as u32,
        file_type: input.file_type,
        hash,
        chunks,
        author: agent_info()?.agent_initial_pubkey,
        created_at: sys_time()?,
    };
    
    let metadata_hash = create_entry(EntryTypes::FileMetadata(metadata.clone()))?;
    
    // Create links
    let all_files_anchor = Path::from("all_files");
    let _anchor_hash = all_files_anchor.clone().typed(LinkTypes::AllFiles)?.ensure()?;
    create_link(
        all_files_anchor.path_entry_hash()?,
        metadata_hash.clone(),
        LinkTypes::AllFiles,
        (),
    )?;
    
    let agent_pub_key = agent_info()?.agent_initial_pubkey;
    create_link(
        agent_pub_key,
        metadata_hash.clone(),
        LinkTypes::AgentToFiles,
        (),
    )?;
    
    // Link chunks to metadata
    for chunk_hash in &metadata.chunks {
        create_link(
            metadata_hash.clone(),
            chunk_hash.clone(),
            LinkTypes::FileToChunks,
            (),
        )?;
    }
    
    Ok(FileMetadataOutput {
        metadata_hash,
        metadata,
    })
}

/// Get file by its metadata hash
#[hdk_extern]
pub fn get_file(metadata_hash: ActionHash) -> ExternResult<FileOutput> {
    let record = get(metadata_hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest("File not found".into())))?;
    
    let metadata: FileMetadata = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Failed to deserialize: {:?}", e))))?
        .ok_or(wasm_error!(WasmErrorInner::Guest("Invalid file metadata".into())))?;
    
    // Reconstruct file data from chunks
    let mut data = Vec::new();
    for chunk_hash in &metadata.chunks {
        let chunk_record = get(chunk_hash.clone(), GetOptions::default())?
            .ok_or(wasm_error!(WasmErrorInner::Guest("Chunk not found".into())))?;
        
        let chunk: FileChunk = chunk_record
            .entry()
            .to_app_option()
            .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Failed to deserialize chunk: {:?}", e))))?
            .ok_or(wasm_error!(WasmErrorInner::Guest("Invalid chunk data".into())))?;
        
        data.extend_from_slice(&chunk.data);
    }
    
    Ok(FileOutput { metadata, data })
}

/// Get all files uploaded by an agent
#[hdk_extern]
pub fn get_my_files(_: ()) -> ExternResult<Vec<FileMetadataOutput>> {
    let agent_pub_key = agent_info()?.agent_initial_pubkey;
    
    let links = get_links(
        LinkQuery::try_new(agent_pub_key, LinkTypes::AgentToFiles)?,
        GetStrategy::Local,
    )?;
    
    let mut files = Vec::new();
    for link in links {
        if let Some(record) = get(link.target.clone().into_action_hash().ok_or(wasm_error!(
            WasmErrorInner::Guest("Invalid link target".into())
        ))?, GetOptions::default())? {
            if let Some(metadata) = record.entry().to_app_option::<FileMetadata>().map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Failed to deserialize: {:?}", e))))? {
                files.push(FileMetadataOutput {
                    metadata_hash: link.target.into_action_hash().unwrap(),
                    metadata,
                });
            }
        }
    }
    
    Ok(files)
}

/// Delete a file and its chunks
#[hdk_extern]
pub fn delete_file(metadata_hash: ActionHash) -> ExternResult<()> {
    let record = get(metadata_hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest("File not found".into())))?;
    
    let metadata: FileMetadata = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Failed to deserialize: {:?}", e))))?
        .ok_or(wasm_error!(WasmErrorInner::Guest("Invalid file metadata".into())))?;
    
    // Delete all chunks
    for chunk_hash in &metadata.chunks {
        delete_entry(chunk_hash.clone())?;
    }
    
    // Delete metadata
    delete_entry(metadata_hash)?;
    
    Ok(())
}

use sha2::Digest;
