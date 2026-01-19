import { ActionHash, AgentPubKey, EntryHash } from "@holochain/client";

export interface Event {
  title: string;
  description: string;
  location: string;
  event_date: number; // timestamp in seconds
  host: AgentPubKey;
  attendees: AgentPubKey[];
  max_attendees: number | null;
  created_at: number;
}

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  event_date: number;
  max_attendees: number | null;
}

// Matches backend EventOutput
export interface EventOutput {
  event: Event;
  action_hash: ActionHash;
  entry_hash: EntryHash;
}
