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
} from './validation';

describe('Validation Schemas', () => {
  describe('inviteCodeSchema', () => {
    it('should accept valid invite code', () => {
      const validCode = 'OURBLOCK_V1:test:123:456:789';
      const result = validateField(inviteCodeSchema, validCode);
      expect(result.success).toBe(true);
    });

    it('should reject invalid format', () => {
      const invalidCode = 'invalid-code';
      const result = validateField(inviteCodeSchema, invalidCode);
      expect(result.success).toBe(false);
    });

    it('should reject code without OURBLOCK_V1 prefix', () => {
      const invalidCode = 'test:123:456:789';
      const result = validateField(inviteCodeSchema, invalidCode);
      expect(result.success).toBe(false);
    });

    it('should reject code too short', () => {
      const shortCode = 'OURBLOCK';
      const result = validateField(inviteCodeSchema, shortCode);
      expect(result.success).toBe(false);
    });
  });

  describe('neighborhoodNameSchema', () => {
    it('should accept valid neighborhood name', () => {
      const validName = 'Main Street Block';
      const result = validateField(neighborhoodNameSchema, validName);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Main Street Block');
      }
    });

    it('should trim whitespace', () => {
      const nameWithSpaces = '  Main Street  ';
      const result = validateField(neighborhoodNameSchema, nameWithSpaces);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Main Street');
      }
    });

    it('should reject names with special characters', () => {
      const invalidName = 'Main<Street>';
      const result = validateField(neighborhoodNameSchema, invalidName);
      expect(result.success).toBe(false);
    });

    it('should reject empty names', () => {
      const emptyName = '';
      const result = validateField(neighborhoodNameSchema, emptyName);
      expect(result.success).toBe(false);
    });

    it('should reject names longer than 100 chars', () => {
      const longName = 'a'.repeat(101);
      const result = validateField(neighborhoodNameSchema, longName);
      expect(result.success).toBe(false);
    });
  });

  describe('postTitleSchema', () => {
    it('should accept valid post title', () => {
      const validTitle = 'Community Potluck Tomorrow!';
      const result = validateField(postTitleSchema, validTitle);
      expect(result.success).toBe(true);
    });

    it('should trim whitespace', () => {
      const title = '  Community Event  ';
      const result = validateField(postTitleSchema, title);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Community Event');
      }
    });

    it('should reject empty titles', () => {
      const emptyTitle = '';
      const result = validateField(postTitleSchema, emptyTitle);
      expect(result.success).toBe(false);
    });

    it('should reject titles longer than 200 chars', () => {
      const longTitle = 'a'.repeat(201);
      const result = validateField(postTitleSchema, longTitle);
      expect(result.success).toBe(false);
    });
  });

  describe('postContentSchema', () => {
    it('should accept valid post content', () => {
      const validContent = 'Join us for a potluck at 6pm!';
      const result = validateField(postContentSchema, validContent);
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const emptyContent = '';
      const result = validateField(postContentSchema, emptyContent);
      expect(result.success).toBe(false);
    });

    it('should reject content longer than 10000 chars', () => {
      const longContent = 'a'.repeat(10001);
      const result = validateField(postContentSchema, longContent);
      expect(result.success).toBe(false);
    });
  });

  describe('nicknameSchema', () => {
    it('should accept valid nickname', () => {
      const validNickname = 'JohnDoe123';
      const result = validateField(nicknameSchema, validNickname);
      expect(result.success).toBe(true);
    });

    it('should reject nicknames with special characters', () => {
      const invalidNickname = 'John<Doe>';
      const result = validateField(nicknameSchema, invalidNickname);
      expect(result.success).toBe(false);
    });

    it('should reject nicknames longer than 50 chars', () => {
      const longNickname = 'a'.repeat(51);
      const result = validateField(nicknameSchema, longNickname);
      expect(result.success).toBe(false);
    });
  });

  describe('urlSchema', () => {
    it('should accept valid HTTP URL', () => {
      const validUrl = 'http://example.com';
      const result = validateField(urlSchema, validUrl);
      expect(result.success).toBe(true);
    });

    it('should accept valid HTTPS URL', () => {
      const validUrl = 'https://example.com';
      const result = validateField(urlSchema, validUrl);
      expect(result.success).toBe(true);
    });

    it('should reject non-HTTP(S) URLs', () => {
      const invalidUrl = 'ftp://example.com';
      const result = validateField(urlSchema, invalidUrl);
      expect(result.success).toBe(false);
    });

    it('should reject invalid URLs', () => {
      const invalidUrl = 'not-a-url';
      const result = validateField(urlSchema, invalidUrl);
      expect(result.success).toBe(false);
    });
  });

  describe('hubAddressSchema', () => {
    it('should accept localhost with port', () => {
      const validAddress = 'localhost:8888';
      const result = validateField(hubAddressSchema, validAddress);
      expect(result.success).toBe(true);
    });

    it('should accept IP address with port', () => {
      const validAddress = '192.168.1.1:8888';
      const result = validateField(hubAddressSchema, validAddress);
      expect(result.success).toBe(true);
    });

    it('should accept domain with port', () => {
      const validAddress = 'example.com:8888';
      const result = validateField(hubAddressSchema, validAddress);
      expect(result.success).toBe(true);
    });

    it('should accept HTTPS URL', () => {
      const validAddress = 'https://example.com:8888';
      const result = validateField(hubAddressSchema, validAddress);
      expect(result.success).toBe(true);
    });

    it('should reject address without port', () => {
      const invalidAddress = 'localhost';
      const result = validateField(hubAddressSchema, invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should reject invalid format', () => {
      const invalidAddress = 'not@valid';
      const result = validateField(hubAddressSchema, invalidAddress);
      expect(result.success).toBe(false);
    });
  });
});
