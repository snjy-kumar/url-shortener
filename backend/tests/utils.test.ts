import {
  prisma,
  createTestUser,
  createTestUrl,
  cleanupTestData,
} from './setup';
import { generateShortCode, isValidUrl, normalizeUrl } from '../src/utils/url';

describe('URL Utilities', () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe('generateShortCode', () => {
    it('should generate a short code', () => {
      const shortCode = generateShortCode();
      expect(shortCode).toBeDefined();
      expect(typeof shortCode).toBe('string');
      expect(shortCode.length).toBeGreaterThan(0);
    });

    it('should generate different codes on multiple calls', () => {
      const code1 = generateShortCode();
      const code2 = generateShortCode();
      expect(code1).not.toBe(code2);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://subdomain.example.com/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('normalizeUrl', () => {
    it('should add https protocol to URLs without protocol', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com');
      expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
    });

    it('should not modify URLs that already have protocol', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    });
  });
});

describe('Database Models', () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe('User Model', () => {
    it('should create a user', async () => {
      const user = await createTestUser();
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });
  });

  describe('URL Model', () => {
    it('should create a URL without user', async () => {
      const url = await createTestUrl();
      expect(url).toBeDefined();
      expect(url.shortCode).toBe('test123');
      expect(url.originalUrl).toBe('https://example.com');
    });

    it('should create a URL with user', async () => {
      const user = await createTestUser();
      const url = await createTestUrl(user.id);
      expect(url).toBeDefined();
      expect(url.userId).toBe(user.id);
    });
  });
});
