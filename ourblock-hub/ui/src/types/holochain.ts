/**
 * Type Extensions for Holochain Client
 * 
 * These interfaces extend the @holochain/client types to include
 * properties that exist in the actual API but may not be fully
 * typed in the current version of the client library.
 * 
 * Note: As @holochain/client evolves, these may become redundant
 * and should be reviewed with each update.
 */

import type { InstalledAppId, AgentPubKey } from '@holochain/client';

/**
 * InstallAppRequest - Parameters for adminWs.installApp()
 * 
 * Extends the standard InstallAppRequest to include membrane_proofs
 * and network_seed which are required for joining private networks.
 */
export interface InstallAppRequest {
  /** Unique identifier for this app installation */
  installed_app_id: InstalledAppId;
  
  /** Optional: specific agent key to use (undefined = generate new) */
  agent_key?: AgentPubKey;
  
  /** Path to the app bundle (.happ file) or bundle bytes */
  path?: string;
  bundle?: Uint8Array;
  
  /** 
   * Membrane proofs for each role in the app
   * Key: role name (e.g., "our_block")
   * Value: Serialized membrane proof (invite code as Uint8Array)
   */
  membrane_proofs?: Record<string, Uint8Array>;
  
  /** 
   * Network seed for DHT isolation
   * Creates a separate network for private neighborhoods
   */
  network_seed?: string;
  
  /** Optional: Source for the app bundle */
  source?: any;
}

/**
 * AttachAppInterfaceRequest - Parameters for adminWs.attachAppInterface()
 */
export interface AttachAppInterfaceRequest {
  /** Port number for the app WebSocket interface */
  port?: number;
  
  /** Allowed origins for CORS (* = allow all) */
  allowed_origins?: string;
  
  /** Optional: Specific installed app ID to attach */
  installed_app_id?: InstalledAppId;
}

/**
 * Signal payload types for type-safe signal handling
 */
export interface PostSignalPayload {
  type: 'NewPost';
  post_hash: Uint8Array;
  author: Uint8Array;
}

export interface EventSignalPayload {
  type: 'NewEvent';
  event_hash: Uint8Array;
  author: Uint8Array;
}

export interface MessageSignalPayload {
  type: 'NewMessage';
  message_hash: Uint8Array;
  channel_hash: Uint8Array;
  author: Uint8Array;
}

export type OurBlockSignalPayload = 
  | PostSignalPayload 
  | EventSignalPayload 
  | MessageSignalPayload;

/**
 * Type guard for signal payloads
 */
export function isPostSignal(payload: any): payload is PostSignalPayload {
  return payload && payload.type === 'NewPost';
}

export function isEventSignal(payload: any): payload is EventSignalPayload {
  return payload && payload.type === 'NewEvent';
}

export function isMessageSignal(payload: any): payload is MessageSignalPayload {
  return payload && payload.type === 'NewMessage';
}
