import { randomBytes } from 'crypto';
import { config } from '../config/env.js';

/** Lowercase alphabet — all codes stored/compared case-insensitively. */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ALPHABET_LEN = ALPHABET.length;
/** Largest multiple of 36 under 256 — rejection sampling for uniform picks. */
const UNIFORM_BYTE_LIMIT = 252;

export const RESERVED_SHORT_CODES = new Set([
  'api',
  'health',
  'favicon.ico',
  'robots.txt',
]);

export const normalizeShortCode = (code: string): string =>
  code.trim().toLowerCase();

/** Normalize + validate custom alias. Throws AppError via caller using returned checks. */
export const parseCustomAlias = (
  alias: string
): { ok: true; shortCode: string } | { ok: false; message: string } => {
  const shortCode = normalizeShortCode(alias);
  if (RESERVED_SHORT_CODES.has(shortCode)) {
    return { ok: false, message: 'This alias is reserved' };
  }
  if (!/^[a-z0-9_-]{3,50}$/.test(shortCode)) {
    return {
      ok: false,
      message:
        'Custom alias must be 3-50 characters (letters, numbers, - or _)',
    };
  }
  return { ok: true, shortCode };
};

export const generateShortCode = (): string => {
  let result = '';
  while (result.length < config.SHORT_CODE_LENGTH) {
    const bytes = randomBytes(config.SHORT_CODE_LENGTH - result.length + 4);
    for (const byte of bytes) {
      if (byte >= UNIFORM_BYTE_LIMIT) {
        continue;
      }
      result += ALPHABET.charAt(byte % ALPHABET_LEN);
      if (result.length === config.SHORT_CODE_LENGTH) {
        break;
      }
    }
  }
  return result;
};

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
];

const isSafeUrl = (url: string): boolean => {
  try {
    const { hostname, protocol } = new URL(url);
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }
    if (BLOCKED_HOSTS.includes(host) || BLOCKED_HOSTS.includes(hostname.toLowerCase())) {
      return false;
    }
    if (host === '::1' || host.endsWith('.localhost')) {
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
  `${config.BASE_URL}/${normalizeShortCode(shortCode)}`;
