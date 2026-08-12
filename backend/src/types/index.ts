declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export interface CreateUrlRequest {
  originalUrl: string;
  customAlias?: string;
  /** Absolute ISO datetime. Mutually exclusive with expiresIn. */
  expiresAt?: string | null;
  /** Relative: seconds number, or "30m" / "12h" / "7d" / "1w". */
  expiresIn?: string | number | null;
  /** Expire after this many successful redirects. */
  maxClicks?: number | null;
  /** Cloudflare Turnstile token (guest create when captcha configured). */
  turnstileToken?: string;
}

export interface ClaimUrlRequest {
  claimToken: string;
}

export interface UpdateUrlRequest {
  originalUrl?: string;
  /** Rename short code / custom alias. */
  customAlias?: string;
  isActive?: boolean;
  expiresAt?: string | null;
  expiresIn?: string | number | null;
  maxClicks?: number | null;
}

export interface UrlResponse {
  id: number;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  isActive: boolean;
  clickCount: number;
  expiresAt: string | null;
  maxClicks: number | null;
  isExpired: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present once on anonymous create — store to claim later. */
  claimToken?: string;
}
