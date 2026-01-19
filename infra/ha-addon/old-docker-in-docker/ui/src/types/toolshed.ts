/**
 * TypeScript types matching the Tool Shed zome types
 */

// Item Status
export type ItemStatus = 'Available' | 'Borrowed' | 'Unavailable';

// Consumable
export interface Consumable {
  name: string;
  included: boolean;
}

// Item
export interface Item {
  title: string;
  description: string;
  image_hash: Uint8Array | null; // EntryHash
  consumables: Consumable[];
  notes: string;
  owner: Uint8Array; // AgentPubKey
  status: ItemStatus;
  created_at: number; // Timestamp
}

export interface CreateItemInput {
  title: string;
  description: string;
  image_hash: Uint8Array | null;
  consumables: Consumable[];
  notes: string;
}

export interface ItemOutput {
  item: Item;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
}

// Borrow Request
export interface BorrowRequest {
  item_hash: Uint8Array; // ActionHash
  requester: Uint8Array; // AgentPubKey
  owner: Uint8Array; // AgentPubKey
  requested_due_date: number; // Timestamp
  message: string | null;
  created_at: number; // Timestamp
}

export interface RequestBorrowInput {
  item_hash: Uint8Array;
  requested_due_date: number;
  message: string | null;
}

export interface BorrowRequestOutput {
  request: BorrowRequest;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
}

// Transaction
export interface Transaction {
  item_hash: Uint8Array; // ActionHash
  borrower: Uint8Array; // AgentPubKey
  lender: Uint8Array; // AgentPubKey
  due_date: number; // Timestamp
  created_at: number; // Timestamp
  notes: string | null;
}

export type TransactionStatus = 'Pending' | 'Active' | 'Returned' | 'Cancelled';

export interface TransactionOutput {
  transaction: Transaction;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
  status: TransactionStatus;
}

export interface AcceptBorrowInput {
  request_hash: Uint8Array;
  due_date: number;
  notes: string | null;
}

// Validation constants
export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
