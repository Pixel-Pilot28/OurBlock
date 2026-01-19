import { ActionHash, AgentPubKey } from "@holochain/client";

export interface FileMetadata {
  name: string;
  size: number;
  file_type: string;
  hash: string;
  chunks: ActionHash[];
  author: AgentPubKey;
  created_at: number;
}

export interface FileMetadataOutput {
  metadata_hash: ActionHash;
  metadata: FileMetadata;
}

export interface UploadFileInput {
  name: string;
  file_type: string;
  data: Uint8Array;
}

export interface FileOutput {
  metadata: FileMetadata;
  data: Uint8Array;
}
