import api from "../lib/api";
import {
  Url,
  CreateUrlRequest,
  UpdateUrlRequest,
  UrlResponse,
  UrlListResponse,
  AnalyticsResponse,
  QRCodeConfig,
  QRCodeResponse,
  QRCodeStats,
  VerifyPasswordRequest,
  BulkUrlResponse,
  PaginationParams,
  UrlFilters,
  DashboardStats,
} from "../types";

// ==================== URL MANAGEMENT SERVICE ====================

export class UrlService {
  // Create a new URL with advanced features
  static async createUrl(data: CreateUrlRequest): Promise<UrlResponse> {
    const response = await api.post("/urls/shorten", data);
    return response.data;
  }

  // Get user's URLs with pagination and filtering
  static async getUrls(
    params: PaginationParams & UrlFilters = {}
  ): Promise<UrlListResponse> {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);

    // Add filter params
    if (params.search) queryParams.append("search", params.search);
    if (params.isActive !== undefined)
      queryParams.append("isActive", params.isActive.toString());
    if (params.hasPassword !== undefined)
      queryParams.append("hasPassword", params.hasPassword.toString());
    if (params.hasCustomDomain !== undefined)
      queryParams.append("hasCustomDomain", params.hasCustomDomain.toString());
    if (params.userId) queryParams.append("userId", params.userId);

    // Add date range
    if (params.dateRange) {
      queryParams.append("startDate", params.dateRange.start);
      queryParams.append("endDate", params.dateRange.end);
    }

    const response = await api.get(`/urls?${queryParams.toString()}`);
    return response.data;
  }

  // Get a specific URL by ID or short code
  static async getUrl(identifier: string): Promise<UrlResponse> {
    const response = await api.get(`/urls/${identifier}`);
    return response.data;
  }

  // Update an existing URL
  static async updateUrl(
    id: string,
    data: UpdateUrlRequest
  ): Promise<UrlResponse> {
    const response = await api.put(`/urls/${id}`, data);
    return response.data;
  }

  // Delete a URL
  static async deleteUrl(
    id: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/urls/${id}`);
    return response.data;
  }

  // Verify password for protected URL
  static async verifyPassword(
    shortCode: string,
    data: VerifyPasswordRequest
  ): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
    const response = await api.post(`/urls/${shortCode}/verify-password`, data);
    return response.data;
  }

  // Get URL analytics
  static async getAnalytics(
    shortCode: string,
    timeRange?: { startDate?: string; endDate?: string }
  ): Promise<AnalyticsResponse> {
    const params = new URLSearchParams();
    if (timeRange?.startDate) params.append("startDate", timeRange.startDate);
    if (timeRange?.endDate) params.append("endDate", timeRange.endDate);

    const response = await api.get(
      `/urls/${shortCode}/analytics?${params.toString()}`
    );
    return response.data;
  }

  // Toggle URL active status
  static async toggleUrlStatus(id: string): Promise<UrlResponse> {
    const response = await api.patch(`/urls/${id}/toggle-status`);
    return response.data;
  }

  // Create multiple URLs (bulk operation)
  static async createBulkUrls(
    urls: CreateUrlRequest[]
  ): Promise<BulkUrlResponse> {
    const response = await api.post("/urls/bulk", { urls });
    return response.data;
  }

  // Export URLs to CSV
  static async exportUrls(filters?: UrlFilters): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (filters?.search) queryParams.append("search", filters.search);
    if (filters?.isActive !== undefined)
      queryParams.append("isActive", filters.isActive.toString());
    if (filters?.dateRange) {
      queryParams.append("startDate", filters.dateRange.start);
      queryParams.append("endDate", filters.dateRange.end);
    }

    const response = await api.get(
      `/urls/export/csv?${queryParams.toString()}`,
      {
        responseType: "blob",
      }
    );
    return response.data;
  }
}

// ==================== QR CODE SERVICE ====================

export class QRCodeService {
  // Generate QR code for a URL
  static async generateQRCode(config: QRCodeConfig): Promise<QRCodeResponse> {
    const response = await api.post(`/qr/${config.shortCode}`, {
      size: config.size || 256,
      color: config.color || "#000000",
      backgroundColor: config.backgroundColor || "#FFFFFF",
      format: config.format || "PNG",
      errorCorrectionLevel: config.errorCorrectionLevel || "M",
      margin: config.margin || 4,
      quality: config.quality || 0.92,
    });
    return response.data;
  }

  // Download QR code file
  static async downloadQRCode(
    shortCode: string,
    format: "PNG" | "SVG" = "PNG",
    filename?: string
  ): Promise<Blob> {
    const response = await api.get(`/qr/${shortCode}/download`, {
      params: { format, filename },
      responseType: "blob",
    });
    return response.data;
  }

  // Get QR code statistics
  static async getQRStats(
    shortCode: string
  ): Promise<{ success: boolean; data: QRCodeStats }> {
    const response = await api.get(`/qr/${shortCode}/stats`);
    return response.data;
  }

  // Batch generate QR codes for multiple URLs
  static async generateBulkQRCodes(
    shortCodes: string[],
    config: Omit<QRCodeConfig, "shortCode">
  ): Promise<{
    success: boolean;
    data: Array<{ shortCode: string; qrCodeData: string; error?: string }>;
  }> {
    const response = await api.post("/qr/bulk", {
      shortCodes,
      config,
    });
    return response.data;
  }
}

// ==================== AUTHENTICATION SERVICE ====================

export class AuthService {
  // User registration
  static async register(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{
    success: boolean;
    data: { user: any; token: string; refreshToken?: string };
    message: string;
  }> {
    const response = await api.post("/auth/register", data);
    return response.data;
  }

  // User login
  static async login(data: {
    email: string;
    password: string;
  }): Promise<{
    success: boolean;
    data: { user: any; token: string; refreshToken?: string };
    message: string;
  }> {
    const response = await api.post("/auth/login", data);
    return response.data;
  }

  // Refresh token
  static async refreshToken(
    refreshToken: string
  ): Promise<{
    success: boolean;
    data: { token: string; refreshToken?: string };
  }> {
    const response = await api.post("/auth/refresh", { refreshToken });
    return response.data;
  }

  // Logout
  static async logout(): Promise<{ success: boolean; message: string }> {
    const response = await api.post("/auth/logout");
    return response.data;
  }
}

// ==================== UTILITY FUNCTIONS ====================

export class UrlUtils {
  // Validate URL format
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Generate short code preview
  static generateShortCode(length: number = 6): string {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }

  // Format click count
  static formatClickCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  // Get relative time
  static getRelativeTime(date: string): string {
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return then.toLocaleDateString();
  }

  // Truncate URL for display
  static truncateUrl(url: string, maxLength: number = 50): string {
    if (url.length <= maxLength) return url;
    return `${url.substring(0, maxLength - 3)}...`;
  }

  // Check if URL is expired
  static isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }
}

// Export all services as default object
const urlService = {
  UrlService,
  QRCodeService,
  AuthService,
  UrlUtils,
};

export default urlService;
