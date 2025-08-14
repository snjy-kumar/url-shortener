import { config } from '../config/env';

// Simple short code generator using Math.random for now
export const generateShortCode = (): string => {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < config.SHORT_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
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
 * Validate if a string is a valid URL
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

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
