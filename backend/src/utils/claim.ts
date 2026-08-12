import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const hashClaimToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const generateClaimToken = (): string =>
  randomBytes(24).toString('base64url');

export const claimTokensMatch = (
  plain: string,
  storedHash: string | null | undefined
): boolean => {
  if (!storedHash) {
    return false;
  }
  const a = Buffer.from(hashClaimToken(plain), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
};

export const hashIp = (ip: string | undefined): string | null => {
  if (!ip) {
    return null;
  }
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
};
