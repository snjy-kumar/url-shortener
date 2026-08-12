import { config } from '../config/env.js';
import { AppError } from './errors.js';

/**
 * Cloudflare Turnstile verify.
 * Skipped when TURNSTILE_SECRET_KEY unset (local/dev).
 * Required in production when secret is configured — guests must pass token.
 */
export const verifyTurnstileIfNeeded = async (
  token: string | undefined,
  remoteIp: string | undefined,
  isGuest: boolean
): Promise<void> => {
  if (!isGuest) {
    return;
  }

  const secret = config.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (config.NODE_ENV === 'production' && config.TURNSTILE_REQUIRED_IN_PROD) {
      throw new AppError('CAPTCHA not configured', 503);
    }
    return;
  }

  if (!token) {
    throw new AppError('CAPTCHA token required', 400);
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body,
    }
  );

  if (!res.ok) {
    throw new AppError('CAPTCHA verification failed', 502);
  }

  const json = (await res.json()) as { success?: boolean };
  if (!json.success) {
    throw new AppError('CAPTCHA failed', 400);
  }
};
