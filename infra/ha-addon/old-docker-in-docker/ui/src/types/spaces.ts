import { ActionHash, AgentPubKey, EntryHash } from "@holochain/client";

export interface Space {
  name: string;
  description: string;
  capacity: number;
  available_hours: string;
  manager: AgentPubKey;
  created_at: number;
}

export interface CreateSpaceInput {
  name: string;
  description: string;
  capacity: number;
  available_hours: string;
}

// Matches backend SpaceOutput
export interface SpaceOutput {
  space: Space;
  action_hash: ActionHash;
  entry_hash: EntryHash;
}

export interface Reservation {
  space_hash: ActionHash;
  reserver: AgentPubKey;
  start_time: number; // timestamp in seconds
  end_time: number;
  purpose: string | null;
  created_at: number;
}

export interface CreateReservationInput {
  space_hash: ActionHash;
  start_time: number;
  end_time: number;
  purpose: string | null;
}

// Matches backend ReservationOutput
export interface ReservationOutput {
  reservation: Reservation;
  action_hash: ActionHash;
  entry_hash: EntryHash;
}
