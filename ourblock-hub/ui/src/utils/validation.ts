/**
 * Validation Schemas
 * 
 * Centralized Zod schemas for input validation across the application.
 * Prevents XSS, injection attacks, and data corruption.
 */

import { z } from 'zod';

/**
 * Invite Code Validation
 * Supports both V1 (colon-separated) and V2 (JSON-based) formats
 * V1 Format: OURBLOCK_V1:HubAddress:NetworkSeed:Timestamp:Signature
 * V2 Format: OURBLOCK_V2:[Base64-encoded JSON]
 */
export const inviteCodeSchema = z
  .string()
  .min(10, 'Invite code is too short')
  .max(2000, 'Invite code is too long')
  .refine(
    (code) => code.startsWith('OURBLOCK_V1:') || code.startsWith('OURBLOCK_V2:'),
    'Invalid invite code format - must start with OURBLOCK_V1: or OURBLOCK_V2:'
  )
  .refine(
    (code) => {
      if (code.startsWith('OURBLOCK_V1:')) {
        // V1: Must have exactly 5 colon-separated parts
        return code.split(':').length === 5;
      } else if (code.startsWith('OURBLOCK_V2:')) {
        // V2: Must have base64-encoded JSON after prefix
        try {
          const payloadB64 = code.substring('OURBLOCK_V2:'.length);
          const payloadJson = atob(payloadB64);
          const payload = JSON.parse(payloadJson);
          return payload.network_seed && payload.signature && payload.signal_url;
        } catch {
          return false;
        }
      }
      return false;
    },
    'Invalid invite code structure'
  );

/**
 * Neighborhood Name Validation
 * Used when creating new invite codes
 */
export const neighborhoodNameSchema = z
  .string()
  .min(1, 'Neighborhood name is required')
  .max(100, 'Neighborhood name must be 100 characters or less')
  .regex(
    /^[a-zA-Z0-9\s\-_']+$/,
    'Neighborhood name can only contain letters, numbers, spaces, hyphens, underscores, and apostrophes'
  )
  .transform((val) => val.trim());

/**
 * Validity Days Validation
 * For invite code expiration
 */
export const validityDaysSchema = z
  .number()
  .int('Validity must be a whole number')
  .min(1, 'Validity must be at least 1 day')
  .max(365, 'Validity cannot exceed 365 days');

/**
 * Post Content Validation
 */
export const postTitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or less')
  .transform((val) => val.trim());

export const postContentSchema = z
  .string()
  .min(1, 'Content is required')
  .max(10000, 'Content must be 10,000 characters or less')
  .transform((val) => val.trim());

/**
 * Event Validation
 */
export const eventTitleSchema = z
  .string()
  .min(1, 'Event title is required')
  .max(200, 'Event title must be 200 characters or less')
  .transform((val) => val.trim());

export const eventDescriptionSchema = z
  .string()
  .max(5000, 'Event description must be 5,000 characters or less')
  .optional()
  .transform((val) => val?.trim());

export const eventLocationSchema = z
  .string()
  .max(300, 'Location must be 300 characters or less')
  .optional()
  .transform((val) => val?.trim());

export const eventDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Invalid date format')
  .refine(
    (dateStr) => {
      const date = new Date(dateStr);
      return date > new Date();
    },
    'Event date must be in the future'
  );

/**
 * Profile Validation
 */
export const nicknameSchema = z
  .string()
  .min(1, 'Nickname is required')
  .max(50, 'Nickname must be 50 characters or less')
  .regex(
    /^[a-zA-Z0-9\s\-_']+$/,
    'Nickname can only contain letters, numbers, spaces, hyphens, underscores, and apostrophes'
  )
  .transform((val) => val.trim());

export const bioSchema = z
  .string()
  .max(500, 'Bio must be 500 characters or less')
  .optional()
  .transform((val) => val?.trim());

/**
 * Chat Message Validation
 */
export const chatMessageSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(2000, 'Message must be 2,000 characters or less')
  .transform((val) => val.trim());

/**
 * URL Validation
 * For external links, file uploads, etc.
 */
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2000, 'URL too long')
  .refine(
    (url) => {
      // Only allow http and https protocols
      return url.startsWith('http://') || url.startsWith('https://');
    },
    'URL must use HTTP or HTTPS protocol'
  );

/**
 * Hub Address Validation
 * For invite codes and configuration
 */
export const hubAddressSchema = z
  .string()
  .min(1, 'Hub address is required')
  .max(253, 'Hub address is too long')
  .refine(
    (addr) => {
      // Allow localhost:port, IP:port, or domain:port patterns
      const localhostPattern = /^localhost:\d{1,5}$/;
      const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/;
      const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]:\d{1,5}$/;
      const httpsPattern = /^https:\/\/[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9](:\d{1,5})?$/;
      
      return (
        localhostPattern.test(addr) ||
        ipPattern.test(addr) ||
        domainPattern.test(addr) ||
        httpsPattern.test(addr)
      );
    },
    'Hub address must be a valid hostname:port or https://hostname format'
  );

/**
 * Helper function to safely validate and return errors
 */
export function validateField<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(value);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      error: result.error.issues[0]?.message || 'Validation failed',
    };
  }
}
