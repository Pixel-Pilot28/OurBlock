/**
 * TypeScript types for the ephemeral Chat zome
 */

// Chat Message (ephemeral - not stored in DHT)
export interface ChatMessage {
  sender: Uint8Array; // AgentPubKey
  content: string;
  timestamp: number; // milliseconds since epoch
  message_id: string;
}

// Signal types
export type ChatSignal =
  | { type: 'Message'; sender: Uint8Array; content: string; timestamp: number; message_id: string }
  | { type: 'Typing'; sender: Uint8Array }
  | { type: 'Read'; sender: Uint8Array; message_id: string }
  | { type: 'Online'; agent: Uint8Array }
  | { type: 'Offline'; agent: Uint8Array };

// Input/Output types
export interface SendMessageInput {
  recipient: Uint8Array;
  message: string;
}

export interface SendMessageOutput {
  message_id: string;
  timestamp: number;
  success: boolean;
}

export interface SendTypingInput {
  recipient: Uint8Array;
}

export interface SendReadReceiptInput {
  recipient: Uint8Array;
  message_id: string;
}

// Local storage types for chat history
export interface StoredMessage {
  id: string;
  sender: string; // hex-encoded agent key
  recipient: string; // hex-encoded agent key
  content: string;
  timestamp: number;
  isOutgoing: boolean;
  read: boolean;
}

export interface ChatConversation {
  peerId: string; // hex-encoded agent key
  messages: StoredMessage[];
  lastActivity: number;
  unreadCount: number;
}

// Validation constants
export const MAX_MESSAGE_LENGTH = 5000;

// Helper to convert Uint8Array to hex string
export function agentKeyToHex(key: Uint8Array): string {
  return Array.from(key)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper to shorten agent key for display
export function shortenAgentKey(key: Uint8Array | string): string {
  const hex = typeof key === 'string' ? key : agentKeyToHex(key);
  return `${hex.slice(0, 8)}...${hex.slice(-4)}`;
}
