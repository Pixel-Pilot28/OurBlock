import { describe, it, expect } from 'vitest';
import { 
  inviteCodeSchema, 
  neighborhoodNameSchema,
  postTitleSchema,
  postContentSchema,
  nicknameSchema,
  urlSchema,
  hubAddressSchema,
  validateField,
} from '../validation';

describe('validation schemas', () => {
  describe('inviteCodeSchema', () => {
    it('should accept valid invite code', () => {
      const validCode = 'OURBLOCK_V1:app_id:network_seed:pubkey:signature';
      const result = validateField(inviteCodeSchema, validCode);
      expect(result.success).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = validateField(inviteCodeSchema, 'invalid');
      expect(result.success).toBe(false);
    });

    it('should reject too short code', () => {
      const result = validateField(inviteCodeSchema, 'OURBLOCK');
      expect(result.success).toBe(false);
    });
  });

  describe('neighborhoodNameSchema', () => {
    it('should accept valid name', () => {
      const result = validateField(neighborhoodNameSchema, 'My Neighborhood');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('My Neighborhood');
      }
    });

    it('should trim whitespace', () => {
      const result = validateField(neighborhoodNameSchema, '  Test  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Test');
      }
    });

    it('should reject special characters', () => {
      const result = validateField(neighborhoodNameSchema, 'Test@123');
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = validateField(neighborhoodNameSchema, '');
      expect(result.success).toBe(false);
    });

    it('should reject too long name', () => {
      const longName = 'a'.repeat(101);
      const result = validateField(neighborhoodNameSchema, longName);
      expect(result.success).toBe(false);
    });
  });

  describe('postTitleSchema', () => {
    it('should accept valid title', () => {
      const result = validateField(postTitleSchema, 'Hello Neighbors');
      expect(result.success).toBe(true);
    });

    it('should trim whitespace', () => {
      const result = validateField(postTitleSchema, '  Title  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Title');
      }
    });

    it('should reject empty title', () => {
      const result = validateField(postTitleSchema, '');
      expect(result.success).toBe(false);
    });

    it('should reject too long title', () => {
      const longTitle = 'a'.repeat(201);
      const result = validateField(postTitleSchema, longTitle);
      expect(result.success).toBe(false);
    });
  });

  describe('postContentSchema', () => {
    it('should accept valid content', () => {
      const result = validateField(postContentSchema, 'This is a post');
      expect(result.success).toBe(true);
    });

    it('should trim whitespace', () => {
      const result = validateField(postContentSchema, '  Content  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Content');
      }
    });

    it('should reject empty content', () => {
      const result = validateField(postContentSchema, '');
      expect(result.success).toBe(false);
    });

    it('should reject too long content', () => {
      const longContent = 'a'.repeat(10001);
      const result = validateField(postContentSchema, longContent);
      expect(result.success).toBe(false);
    });
  });

  describe('nicknameSchema', () => {
    it('should accept valid nickname', () => {
      const result = validateField(nicknameSchema, 'John Doe');
      expect(result.success).toBe(true);
    });

    it('should accept numbers', () => {
      const result = validateField(nicknameSchema, 'User123');
      expect(result.success).toBe(true);
    });

    it('should reject too short nickname', () => {
      const result = validateField(nicknameSchema, 'J');
      expect(result.success).toBe(false);
    });

    it('should reject special characters', () => {
      const result = validateField(nicknameSchema, 'User@123');
      expect(result.success).toBe(false);
    });

    it('should reject too long nickname', () => {
      const longNickname = 'a'.repeat(51);
      const result = validateField(nicknameSchema, longNickname);
      expect(result.success).toBe(false);
    });
  });

  describe('urlSchema', () => {
    it('should accept valid HTTP URL', () => {
      const result = validateField(urlSchema, 'http://example.com');
      expect(result.success).toBe(true);
    });

    it('should accept valid HTTPS URL', () => {
      const result = validateField(urlSchema, 'https://example.com');
      expect(result.success).toBe(true);
    });

    it('should reject non-HTTP URLs', () => {
      const result = validateField(urlSchema, 'ftp://example.com');
      expect(result.success).toBe(false);
    });

    it('should reject invalid URLs', () => {
      const result = validateField(urlSchema, 'not a url');
      expect(result.success).toBe(false);
    });
  });

  describe('hubAddressSchema', () => {
    it('should accept localhost with port', () => {
      const result = validateField(hubAddressSchema, 'localhost:8888');
      expect(result.success).toBe(true);
    });

    it('should accept IP with port', () => {
      const result = validateField(hubAddressSchema, '192.168.1.1:8888');
      expect(result.success).toBe(true);
    });

    it('should accept domain with port', () => {
      const result = validateField(hubAddressSchema, 'example.com:8888');
      expect(result.success).toBe(true);
    });

    it('should accept HTTPS URL', () => {
      const result = validateField(hubAddressSchema, 'https://example.com');
      expect(result.success).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = validateField(hubAddressSchema, 'invalid');
      expect(result.success).toBe(false);
    });

    it('should reject too long address', () => {
      const longAddr = 'a'.repeat(254) + ':8888';
      const result = validateField(hubAddressSchema, longAddr);
      expect(result.success).toBe(false);
    });
  });
});
