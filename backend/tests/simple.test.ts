import { generateShortCode, isValidUrl, normalizeUrl } from '../src/utils/url';

describe('URL Utilities', () => {
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
