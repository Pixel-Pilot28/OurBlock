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

// Reaction
export interface Reaction {
  post_hash: Uint8Array; // ActionHash
  author: Uint8Array; // AgentPubKey
  reaction_type: string;
  created_at: number; // Timestamp
}

export interface CreateReactionInput {
  post_hash: Uint8Array;
  reaction_type: string;
}

export interface ReactionOutput {
  reaction: Reaction;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
}

// Comment
export interface Comment {
  post_hash: Uint8Array; // ActionHash
  author: Uint8Array; // AgentPubKey
  content: string;
  created_at: number; // Timestamp
}

export interface CreateCommentInput {
  post_hash: Uint8Array;
  content: string;
}

export interface CommentOutput {
  comment: Comment;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
}

// Validation constants matching the integrity zome
export const MIN_TITLE_LENGTH = 5;
export const MAX_TITLE_LENGTH = 100;
export const MAX_CONTENT_LENGTH = 5000;
export const MAX_COMMENT_LENGTH = 1000;
