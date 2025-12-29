/**
 * TypeScript types matching the Feed zome types
 */

export interface Post {
  title: string;
  content: string;
  author: Uint8Array; // AgentPubKey
  created_at: number; // Timestamp
}

export interface CreatePostInput {
  title: string;
  content: string;
}

export interface PostOutput {
  post: Post;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
}

// Validation constants matching the integrity zome
export const MIN_TITLE_LENGTH = 5;
export const MAX_TITLE_LENGTH = 100;
export const MAX_CONTENT_LENGTH = 5000;
