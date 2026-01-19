/**
 * TypeScript types matching the Vouch zome types
 */

export type VouchType = 
  | 'PhysicalHandshake'
  | 'ExistingRelationship'
  | 'TrustedIntroduction';

export interface Vouch {
  vouchee: Uint8Array; // AgentPubKey
  vouch_type: VouchType;
  timestamp: number;
  note: string | null;
}

export interface CreateVouchInput {
  vouchee: Uint8Array; // AgentPubKey
  vouch_type: VouchType;
  note: string | null;
}

export interface VouchOutput {
  vouch: Vouch;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
  voucher: Uint8Array; // AgentPubKey
}

export interface VouchInfo {
  voucher: Uint8Array; // AgentPubKey
  vouch: Vouch;
  action_hash: Uint8Array;
  is_from_anchor: boolean;
}

export type MembershipStatus =
  | { type: 'Pending' }
  | { type: 'PartiallyVouched'; vouch_count: number }
  | { type: 'Verified' }
  | { type: 'TrustedAnchor' };

export interface MembershipInfo {
  agent: Uint8Array; // AgentPubKey
  status: MembershipStatus;
  vouches_received: VouchInfo[];
  vouches_given: VouchOutput[];
  is_anchor: boolean;
}

export interface TrustedAnchor {
  agent: Uint8Array; // AgentPubKey
  designated_at: number;
  designated_by: Uint8Array; // AgentPubKey
}

export interface VouchRequest {
  agent: Uint8Array; // AgentPubKey
  timestamp: number;
}

// Constants matching the integrity zome
export const REQUIRED_VOUCHES_FROM_MEMBERS = 2;
export const REQUIRED_VOUCHES_FROM_ANCHOR = 1;
