import { AppError } from './errors.js';

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const MAX_EXPIRES_IN_MS = 5 * 365 * 86_400_000; // ~5 years

/** Parse relative duration: number seconds, or "30m" / "12h" / "7d" / "1w" / "90s". */
export const parseExpiresIn = (value: string | number): Date => {
  let ms: number;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new AppError('expiresIn must be a positive number of seconds', 400);
    }
    ms = value * 1_000;
  } else {
    const raw = value.trim().toLowerCase();
    if (!raw) {
      throw new AppError('expiresIn is empty', 400);
    }

    if (/^\d+$/.test(raw)) {
      ms = parseInt(raw, 10) * 1_000;
    } else {
      const match = raw.match(/^(\d+(?:\.\d+)?)(s|m|h|d|w)$/);
      if (!match) {
        throw new AppError(
          'expiresIn must look like 30m, 12h, 7d, 1w, or seconds',
          400
        );
      }
      const amount = Number(match[1]);
      const unit = match[2] as keyof typeof UNIT_MS;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError('expiresIn amount must be positive', 400);
      }
      ms = amount * (UNIT_MS[unit] ?? 0);
    }
  }

  if (ms > MAX_EXPIRES_IN_MS) {
    throw new AppError('expiresIn is too far in the future (max ~5 years)', 400);
  }

  return new Date(Date.now() + ms);
};

export const parseExpiresAt = (value: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('expiresAt must be a valid ISO datetime', 400);
  }
  if (date.getTime() <= Date.now()) {
    throw new AppError('expiresAt must be in the future', 400);
  }
  return date;
};

export type ExpiryInput = {
  expiresAt?: string | null;
  expiresIn?: string | number | null;
  maxClicks?: number | null;
};

export type ExpiryPatch = {
  expiresAt?: Date | null;
  maxClicks?: number | null;
};

const isSet = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

/** Resolve flexible expiry fields. null clears; undefined = leave unchanged. */
export const resolveExpiryPatch = (input: ExpiryInput): ExpiryPatch => {
  if (isSet(input.expiresAt) && isSet(input.expiresIn)) {
    throw new AppError('Provide expiresAt or expiresIn, not both', 400);
  }

  const patch: ExpiryPatch = {};

  if (input.expiresIn !== undefined) {
    if (!isSet(input.expiresIn)) {
      patch.expiresAt = null;
    } else {
      patch.expiresAt = parseExpiresIn(input.expiresIn as string | number);
    }
  } else if (input.expiresAt !== undefined) {
    if (!isSet(input.expiresAt)) {
      patch.expiresAt = null;
    } else {
      patch.expiresAt = parseExpiresAt(input.expiresAt as string);
    }
  }

  if (input.maxClicks !== undefined) {
    if (input.maxClicks === null) {
      patch.maxClicks = null;
    } else if (
      typeof input.maxClicks !== 'number' ||
      !Number.isInteger(input.maxClicks) ||
      input.maxClicks < 1
    ) {
      throw new AppError('maxClicks must be a positive integer or null', 400);
    } else {
      patch.maxClicks = input.maxClicks;
    }
  }

  return patch;
};

export const isLinkExpired = (url: {
  expiresAt: Date | null;
  maxClicks: number | null;
  clickCount: number;
}): boolean => {
  if (url.expiresAt && url.expiresAt.getTime() <= Date.now()) {
    return true;
  }
  if (url.maxClicks !== null && url.clickCount >= url.maxClicks) {
    return true;
  }
  return false;
};
