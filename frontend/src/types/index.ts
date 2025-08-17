// ==================== USER & AUTHENTICATION TYPES ====================

export interface User {
  id: string;
  email: string;
  name?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
    refreshToken?: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ==================== URL & LINK MANAGEMENT TYPES ====================

export interface Url {
  id: string;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  customAlias?: string;
  customDomain?: string;
  title?: string;
  description?: string;
  password?: string;
  userId?: string;
  clickCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  hasPassword: boolean;
  isExpired: boolean;
  qrCodeUrl?: string;
  hasAR?: boolean;
}

export interface CreateUrlRequest {
  originalUrl: string;
  customAlias?: string;
  customDomain?: string;
  title?: string;
  description?: string;
  password?: string;
  expiresAt?: string;
}

export interface UpdateUrlRequest {
  title?: string;
  description?: string;
  customAlias?: string;
  customDomain?: string;
  password?: string;
  isActive?: boolean;
  expiresAt?: string;
}

export interface VerifyPasswordRequest {
  password: string;
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

export interface BulkUrlResponse {
  success: boolean;
  data: {
    successful: Url[];
    failed: Array<{
      originalUrl: string;
      error: string;
    }>;
  };
}

// ==================== ANALYTICS TYPES ====================

export interface AnalyticsData {
  totalClicks: number;
  uniqueClicks: number;
  clickThroughRate: number;
  averageClicksPerDay: number;
  clicksByDate: { date: string; clicks: number }[];
  topReferrers: { referrer: string; clicks: number }[];
  clicksByCountry: { country: string; clicks: number }[];
  deviceTypes: { device: string; clicks: number }[];
  browsers: { browser: string; clicks: number }[];
  platforms: { platform: string; clicks: number }[];
  clicksByHour: { hour: number; clicks: number }[];
  recentClicks: Array<{
    id: string;
    ipAddress: string;
    userAgent: string;
    referer: string;
    country: string;
    city: string;
    clickedAt: string;
  }>;
}

export interface AnalyticsResponse {
  success: boolean;
  data: AnalyticsData;
}

export interface AnalyticsTimeRange {
  startDate: string;
  endDate: string;
  preset?: "24h" | "7d" | "30d" | "90d" | "custom";
}

// ==================== QR CODE TYPES ====================

export interface QRCodeConfig {
  shortCode: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  format?: "PNG" | "SVG";
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  margin?: number;
  quality?: number;
}

export interface QRCodeResponse {
  success: boolean;
  data?: {
    qrCodeData: string;
    format: string;
    size: number;
    downloadUrl: string;
  };
  message?: string;
}

export interface QRCodeStats {
  totalGenerated: number;
  downloadsCount: number;
  lastGenerated: string;
  popularFormats: Array<{
    format: string;
    count: number;
  }>;
}

// ==================== VALIDATION & ERROR TYPES ====================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: ValidationError[];
  code?: string;
  timestamp?: string;
}

export interface FieldError {
  type: string;
  message: string;
}

// ==================== PAGINATION & FILTERING ====================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UrlFilters {
  search?: string;
  isActive?: boolean;
  hasPassword?: boolean;
  hasCustomDomain?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  userId?: string;
}

// ==================== UI STATE TYPES ====================

export interface LoadingState {
  isLoading: boolean;
  operation?: string;
  progress?: number;
}

export interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  notifications: NotificationItem[];
}

export interface NotificationItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

// ==================== FORM TYPES ====================

export interface FormState<T> {
  data: T;
  errors: Record<string, FieldError>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

export interface UrlFormData {
  originalUrl: string;
  customAlias?: string;
  customDomain?: string;
  title?: string;
  description?: string;
  password?: string;
  expiresAt?: string;
  generateQR?: boolean;
  qrConfig?: Partial<QRCodeConfig>;
}

// ==================== DASHBOARD & METRICS TYPES ====================

export interface DashboardStats {
  totalUrls: number;
  totalClicks: number;
  totalUsers: number;
  activeUrls: number;
  clicksToday: number;
  clicksThisWeek: number;
  clicksThisMonth: number;
  averageClicksPerUrl: number;
  topPerformingUrls: Array<{
    id: string;
    shortCode: string;
    originalUrl: string;
    clickCount: number;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: "url_created" | "url_clicked" | "qr_generated";
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}

// ==================== LEGACY TYPES (for backward compatibility) ====================

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
