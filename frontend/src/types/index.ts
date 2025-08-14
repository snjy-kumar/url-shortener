export interface Url {
  id: string;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  customAlias?: string;
  customDomain?: string;
  description?: string;
  clickCount: number;
  isActive: boolean;
  expiresAt?: string;
  password?: string;
  qrCodeUrl?: string;
  hasAR?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUrlRequest {
  originalUrl: string;
  customAlias?: string;
  customDomain?: string;
  description?: string;
  expiresAt?: string;
  password?: string;
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
  deviceTypes: { device: string; clicks: number }[];
  browsers: { browser: string; clicks: number }[];
  platforms: { platform: string; clicks: number }[];
  clicksByHour: { hour: number; clicks: number }[];
}

export interface QRCodeConfig {
  shortCode: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  logo?: File | string;
  logoSize?: number;
  format?: "PNG" | "SVG";
  arContent?: ARContent;
}

export interface ARContent {
  type: "model" | "business-card" | "product-preview";
  assetUrl?: string;
  data?: {
    name?: string;
    title?: string;
    company?: string;
    email?: string;
    phone?: string;
    website?: string;
    productName?: string;
    productDescription?: string;
    productPrice?: string;
  };
}

export interface AIOptimization {
  suggestedSlugs: string[];
  bestSharingTimes: { platform: string; time: string; score: number }[];
  targetPlatforms: { platform: string; score: number; reason: string }[];
  performanceInsights: string[];
}

export interface PersonalizedRecommendation {
  id: string;
  type:
    | "trending-topic"
    | "campaign-optimization"
    | "audience-target"
    | "seasonal";
  title: string;
  description: string;
  suggestedSlug: string;
  targetUrl?: string;
  priority: "high" | "medium" | "low";
  expiresAt: string;
  createdAt: string;
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
