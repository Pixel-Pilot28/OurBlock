/**
 * TypeScript types matching the Helping Hands zome types
 */

// Request Category
export type RequestCategory =
  | { type: 'Grocery' }
  | { type: 'Moving' }
  | { type: 'Childcare' }
  | { type: 'Transportation' }
  | { type: 'PetCare' }
  | { type: 'Repairs' }
  | { type: 'Medical' }
  | { type: 'Technology' }
  | { type: 'Companionship' }
  | { type: 'Other'; description: string };

// Urgency Level
export type Urgency =
  | { type: 'Low' }
  | { type: 'High' }
  | { type: 'Emergency' };

// Request
export interface Request {
  title: string;
  category: RequestCategory;
  urgency: Urgency;
  description: string;
  author: Uint8Array; // AgentPubKey
  created_at: number; // Timestamp
  is_fulfilled: boolean;
}

export interface CreateRequestInput {
  title: string;
  category: RequestCategory;
  urgency: Urgency;
  description: string;
}

export interface RequestOutput {
  request: Request;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
  comment_count: number;
}

// Comment
export interface Comment {
  request_hash: Uint8Array; // ActionHash
  author: Uint8Array; // AgentPubKey
  content: string;
  is_offer: boolean;
  created_at: number; // Timestamp
}

export interface CreateCommentInput {
  request_hash: Uint8Array;
  content: string;
  is_offer: boolean;
}

export interface CommentOutput {
  comment: Comment;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
}

// Validation constants
export const MIN_TITLE_LENGTH = 3;
export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_COMMENT_LENGTH = 1000;

// Helper functions for categories
export const CATEGORY_LABELS: Record<string, string> = {
  Grocery: '🛒 Grocery',
  Moving: '📦 Moving',
  Childcare: '👶 Childcare',
  Transportation: '🚗 Transportation',
  PetCare: '🐕 Pet Care',
  Repairs: '🔧 Repairs',
  Medical: '🏥 Medical',
  Technology: '💻 Technology',
  Companionship: '💬 Companionship',
  Other: '📋 Other',
};

export const URGENCY_LABELS: Record<string, string> = {
  Low: '🟢 Low',
  High: '🟡 High',
  Emergency: '🔴 Emergency',
};

export function getCategoryLabel(category: RequestCategory): string {
  return CATEGORY_LABELS[category.type] || category.type;
}

export function getUrgencyLabel(urgency: Urgency): string {
  return URGENCY_LABELS[urgency.type] || urgency.type;
}
