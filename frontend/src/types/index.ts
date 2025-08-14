export interface Url {
  id: string;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  customAlias?: string;
  description?: string;
  clickCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUrlRequest {
  originalUrl: string;
  customAlias?: string;
  description?: string;
  expiresAt?: string;
}

export interface UrlResponse {
  success: boolean;
  message?: string;
  data?: Url;
}

export interface UrlListResponse {
  success: boolean;
  data: {
    urls: Url[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface AnalyticsData {
  totalClicks: number;
  uniqueClicks: number;
  clicksByDate: { date: string; clicks: number }[];
  topReferrers: { referrer: string; clicks: number }[];
  clicksByCountry: { country: string; clicks: number }[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
  };
}
