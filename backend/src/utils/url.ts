import { config } from '../config/env';
import { randomBytes } from 'crypto';

// Cryptographically secure short code generator
export const generateShortCode = (): string => {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(config.SHORT_CODE_LENGTH);
  let result = '';
  for (let i = 0; i < config.SHORT_CODE_LENGTH; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
};

/**
 * Base62 encoding for converting numbers to short codes
 */
export class Base62 {
  private static readonly ALPHABET =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  private static readonly BASE = 62;

  static encode(num: number): string {
    if (num === 0) {
      const firstChar = this.ALPHABET[0];
      return firstChar || '0';
    }

    let result = '';
    while (num > 0) {
      result = this.ALPHABET[num % this.BASE] + result;
      num = Math.floor(num / this.BASE);
    }
    return result;
  }

  static decode(str: string): number {
    let result = 0;
    const len = str.length;

    for (let i = 0; i < len; i++) {
      const char = str[len - 1 - i];
      if (!char) {
        throw new Error('Invalid character in Base62 string');
      }
      const value = this.ALPHABET.indexOf(char);
      if (value === -1) {
        throw new Error(`Invalid character in Base62 string: ${char}`);
      }
      result += value * Math.pow(this.BASE, i);
    }
    return result;
  }
}

/**
 * Generate short code from database ID
 */
export const generateShortCodeFromId = (id: number): string => {
  return Base62.encode(id);
};

/**
 * Blacklisted domains/patterns for security
 */
const BLACKLISTED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '10.',
  '172.16.',
  '192.168.',
  'metadata.google.internal',
  '169.254.169.254', // AWS metadata
];

/**
 * Check if URL is potentially malicious
 */\nexport const isSafeUrl = (url: string): boolean => {\n  try {\n    const urlObj = new URL(url);\n    const hostname = urlObj.hostname.toLowerCase();\n    \n    // Check blacklisted domains\n    for (const blocked of BLACKLISTED_DOMAINS) {\n      if (hostname === blocked || hostname.startsWith(blocked)) {\n        return false;\n      }\n    }\n    \n    // Prevent SSRF - block private IPs\n    if (/^(10|172\\.(1[6-9]|2[0-9]|3[0-1])|192\\.168)\\./.test(hostname)) {\n      return false;\n    }\n    \n    return true;\n  } catch {\n    return false;\n  }\n};\n\n/**\n * Validate if a string is a valid URL\n */\nexport const isValidUrl = (url: string): boolean => {\n  try {\n    const urlObj = new URL(url);\n    const isHttps = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';\n    const isSafe = isSafeUrl(url);\n    return isHttps && isSafe;\n  } catch {\n    return false;\n  }\n};

/**
 * Normalize URL by adding protocol if missing
 */
export const normalizeUrl = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
};

/**
 * Extract domain from URL
 */
export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
};

/**
 * Check if custom alias is valid
 */
export const isValidCustomAlias = (alias: string): boolean => {
  // Allow alphanumeric characters, hyphens, and underscores
  // Length between 3 and 50 characters
  const pattern = /^[a-zA-Z0-9_-]{3,50}$/;
  return pattern.test(alias);
};

/**
 * Generate full short URL
 */
export const generateShortUrl = (shortCode: string): string => {
  return `${config.BASE_URL}/${shortCode}`;
};
