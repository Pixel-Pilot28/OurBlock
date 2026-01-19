/**
 * TypeScript types matching the Holochain zome types
 */

export interface Profile {
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  location_metadata: string | null;
}

export interface CreateProfileInput {
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  location_metadata: string | null;
}

export interface ProfileOutput {
  profile: Profile;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
  agent: Uint8Array;
}

// System signal types for profile events
export interface SystemSignal {
  type: 'profile_updated' | 'backup_completed' | 'update_available' | 'system_maintenance';
}

export interface ProfileUpdatedSignal extends SystemSignal {
  type: 'profile_updated';
  agent: Uint8Array;
  action_hash: Uint8Array;
}

export interface BackupCompletedSignal extends SystemSignal {
  type: 'backup_completed';
  timestamp: number;
  status: string;
}

export interface UpdateAvailableSignal extends SystemSignal {
  type: 'update_available';
  current_version: string;
  latest_version: string;
}

export interface SystemMaintenanceSignal extends SystemSignal {
  type: 'system_maintenance';
  message: string;
  severity: string;
}

export type ProfileSystemSignal = 
  | ProfileUpdatedSignal 
  | BackupCompletedSignal 
  | UpdateAvailableSignal 
  | SystemMaintenanceSignal;
