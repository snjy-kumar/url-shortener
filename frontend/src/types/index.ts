export interface CreateUrlRequest {
  originalUrl: string;
  customAlias?: string;
  expiresAt?: string | null;
  expiresIn?: string | number | null;
  maxClicks?: number | null;
  turnstileToken?: string;
  password?: string;
}

export interface UpdateUrlRequest {
  originalUrl?: string;
  customAlias?: string;
  isActive?: boolean;
  expiresAt?: string | null;
  expiresIn?: string | number | null;
  maxClicks?: number | null;
}

export interface Url {
  id: number;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  isActive: boolean;
  clickCount: number;
  expiresAt: string | null;
  maxClicks: number | null;
  isExpired: boolean;
  hasPassword?: boolean;
  createdAt: string;
  updatedAt: string;
  claimToken?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: { field: string; message: string }[];
}
