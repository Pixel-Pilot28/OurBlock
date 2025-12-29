/**
 * TypeScript types matching the Holochain zome types
 */

export interface Profile {
  nickname: string;
  bio: string | null;
  created_at: number;
}

export interface CreateProfileInput {
  nickname: string;
  bio: string | null;
}

export interface ProfileOutput {
  profile: Profile;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
  agent: Uint8Array;
}
