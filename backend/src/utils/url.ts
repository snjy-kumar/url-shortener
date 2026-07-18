import { randomBytes } from 'crypto';
import { config } from '../config/env.js';

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const RESERVED_SHORT_CODES = new Set([
  'api',
  'health',
  'favicon.ico',
  'robots.txt',
]);

export const generateShortCode = (): string => {
  const bytes = randomBytes(config.SHORT_CODE_LENGTH);
  let result = '';
  for (let i = 0; i < config.SHORT_CODE_LENGTH; i++) {
    const byte = bytes[i] ?? 0;
    result += ALPHABET.charAt(byte % ALPHABET.length);
  }
  return result;
};

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'metadata.google.internal',
  '169.254.169.254',
];

const isSafeUrl = (url: string): boolean => {
  try {
    const { hostname, protocol } = new URL(url);
    const host = hostname.toLowerCase();

    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }
    if (BLOCKED_HOSTS.includes(host)) {
      return false;
    }
    if (/^(10|172\.(1[6-9]|2\d|3[0-1])|192\.168)\./.test(host)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

export const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      isSafeUrl(url)
    );
  } catch {
    return false;
  }
};

export const normalizeUrl = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
};

export const generateShortUrl = (shortCode: string): string =>
  `${config.BASE_URL}/${shortCode}`;
