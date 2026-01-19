/**
 * Invite Code Parsing Utilities
 * 
 * Handles parsing and validation of OURBLOCK invite codes
 * Supports both V1 (legacy colon-separated) and V2 (JSON-based P2P) formats
 */

export interface ParsedInviteCodeV1 {
  version: 'V1';
  hubAddress: string;
  networkSeed: string;
  timestamp: number;
  signature: string;
  fullCode: string;
}

export interface ParsedInviteCodeV2 {
  version: 'V2';
  networkSeed: string;
  hubAgentPubKey: string;
  signalUrl: string;
  bootstrapUrl: string;
  timestamp: number;
  signature: string;
  fullCode: string;
}

export type ParsedInviteCode = ParsedInviteCodeV1 | ParsedInviteCodeV2;

/**
 * Parses an OURBLOCK invite code (V1 or V2)
 * 
 * V1 Format: OURBLOCK_V1:[HubAddress]:[NetworkSeed]:[Timestamp]:[Signature]
 * V2 Format: OURBLOCK_V2:[Base64-encoded JSON]
 * 
 * @param inviteCode - The full invite code string
 * @returns Parsed components or null if invalid
 */
export function parseInviteCode(inviteCode: string): ParsedInviteCode | null {
  // Trim whitespace
  const code = inviteCode.trim();

  // Try V2 format first (JSON-based)
  if (code.startsWith('OURBLOCK_V2:')) {
    try {
      // Extract base64 payload
      const payloadB64 = code.substring('OURBLOCK_V2:'.length);
      
      // Decode base64
      const payloadJson = atob(payloadB64);
      
      // Parse JSON
      const payload = JSON.parse(payloadJson);
      
      // Validate required fields
      if (!payload.network_seed || !payload.hub_agent_pub_key || 
          !payload.signal_url || !payload.timestamp || !payload.signature) {
        return null;
      }
      
      return {
        version: 'V2',
        networkSeed: payload.network_seed,
        hubAgentPubKey: payload.hub_agent_pub_key,
        signalUrl: payload.signal_url,
        bootstrapUrl: payload.bootstrap_url || 'https://bootstrap.holochain.org',
        timestamp: payload.timestamp,
        signature: payload.signature,
        fullCode: code,
      };
    } catch (err) {
      console.error('Failed to parse V2 invite code:', err);
      return null;
    }
  }

  // Try V1 format (legacy colon-separated)
  if (code.startsWith('OURBLOCK_V1:')) {
    const parts = code.split(':');
    
    // Should have exactly 5 parts: prefix, hub_address, network_seed, timestamp, signature
    if (parts.length !== 5) {
      return null;
    }

    const [prefix, hubAddress, networkSeed, timestampStr, signature] = parts;

    // Validate prefix
    if (prefix !== 'OURBLOCK_V1') {
      return null;
    }

    // Validate network seed
    if (!networkSeed || networkSeed.length === 0) {
      return null;
    }

    // Parse timestamp
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return null;
    }

    // Validate hub address
    if (!hubAddress || hubAddress.length === 0) {
      return null;
    }

    // Validate signature
    if (!signature || signature.length === 0) {
      return null;
    }

    return {
      version: 'V1',
      hubAddress,
      networkSeed,
      timestamp,
      signature,
      fullCode: code,
    };
  }

  return null;
}

/**
 * Checks if an invite code has expired
 * 
 * @param parsedCode - Parsed invite code
 * @param validityDays - Number of days the code is valid (default: 7)
 * @returns true if expired, false otherwise
 */
export function isInviteCodeExpired(
  parsedCode: ParsedInviteCode,
  validityDays: number = 7
): boolean {
  const now = Date.now() * 1000; // Convert to microseconds
  const validityMicros = validityDays * 24 * 60 * 60 * 1_000_000;
  return now > parsedCode.timestamp + validityMicros;
}

/**
 * Validates an invite code format
 * 
 * @param inviteCode - The invite code to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateInviteCode(inviteCode: string): {
  isValid: boolean;
  error?: string;
} {
  const parsed = parseInviteCode(inviteCode);

  if (!parsed) {
    return {
      isValid: false,
      error: 'Invalid invite code format. Expected OURBLOCK_V1:...',
    };
  }

  if (isInviteCodeExpired(parsed)) {
    return {
      isValid: false,
      error: 'This invite code has expired. Please request a new one.',
    };
  }

  return { isValid: true };
}

/**
 * Formats a timestamp from microseconds to human-readable date
 * 
 * @param microseconds - Timestamp in microseconds
 * @returns Formatted date string
 */
export function formatInviteTimestamp(microseconds: number): string {
  const date = new Date(microseconds / 1000); // Convert to milliseconds
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
