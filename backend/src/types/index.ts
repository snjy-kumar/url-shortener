import { Request } from 'express';

export interface User {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface CreateUrlRequest {
  originalUrl: string;
  customAlias?: string;
  customDomain?: string;
  password?: string;
  expiresAt?: string;
  description?: string;
}

export interface UrlResponse {
  id: string;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  title?: string;
  description?: string;
  customAlias?: string;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  clickCount: number;
}

export interface AnalyticsData {
  totalClicks: number;
  uniqueClicks: number;
  clicksByDate: Array<{
    date: string;
    clicks: number;
  }>;
  clicksByCountry: Array<{
    country: string;
    clicks: number;
  }>;
  clicksByReferer: Array<{
    referer: string;
    clicks: number;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface UserRegistration {
  email: string;
  password: string;
  name?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface JWTPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}
