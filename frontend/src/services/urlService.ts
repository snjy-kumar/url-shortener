import api from "@/lib/api";
import {
  CreateUrlRequest,
  UrlListResponse,
  UrlResponse,
  AnalyticsData,
  QRCodeConfig,
  AIOptimization,
  PersonalizedRecommendation,
  ARContent,
} from "@/types";

export const urlService = {
  // Create short URL
  createShortUrl: async (data: CreateUrlRequest): Promise<UrlResponse> => {
    const response = await api.post("/api/v1/urls/shorten", data);
    return response.data;
  },

  // Get URL list with pagination
  getUrls: async (
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc"
  ): Promise<UrlListResponse> => {
    const response = await api.get("/api/v1/urls", {
      params: { page, limit, sortBy, sortOrder },
    });
    return response.data;
  },

  // Get URL details by short code
  getUrlDetails: async (shortCode: string): Promise<UrlResponse> => {
    const response = await api.get(`/api/v1/urls/${shortCode}`);
    return response.data;
  },

  // Update URL
  updateUrl: async (
    shortCode: string,
    data: Partial<CreateUrlRequest>
  ): Promise<UrlResponse> => {
    const response = await api.put(`/api/v1/urls/${shortCode}`, data);
    return response.data;
  },

  // Delete URL
  deleteUrl: async (
    shortCode: string
  ): Promise<{ success: boolean; message?: string }> => {
    const response = await api.delete(`/api/v1/urls/${shortCode}`);
    return response.data;
  },

  // Get analytics for a URL
  getUrlAnalytics: async (
    shortCode: string,
    dateRange?: { start: string; end: string }
  ): Promise<{ success: boolean; data: AnalyticsData }> => {
    const params = dateRange
      ? { start: dateRange.start, end: dateRange.end }
      : {};
    const response = await api.get(`/api/v1/urls/${shortCode}/analytics`, {
      params,
    });
    return response.data;
  },

  // Generate QR Code
  generateQRCode: async (
    config: QRCodeConfig
  ): Promise<{
    success: boolean;
    data: { qrCodeUrl: string; downloadUrl: string };
  }> => {
    const response = await api.post(`/api/v1/qr/${config.shortCode}`, config);
    return response.data;
  },

  // Add AR content to QR code
  addARContent: async (
    shortCode: string,
    arContent: ARContent
  ): Promise<{ success: boolean; data: { arUrl: string } }> => {
    const response = await api.post(`/api/v1/ar/${shortCode}`, { arContent });
    return response.data;
  },

  // Get AI optimization suggestions
  getAIOptimization: async (
    url: string,
    campaignGoal?: string
  ): Promise<{ success: boolean; data: AIOptimization }> => {
    const response = await api.post("/api/v1/ai/optimize", {
      url,
      campaignGoal,
    });
    return response.data;
  },

  // Get AI insights for existing URL
  getAIInsights: async (
    shortCode: string
  ): Promise<{
    success: boolean;
    data: { insights: string[]; suggestions: string[] };
  }> => {
    const response = await api.get(`/api/v1/ai/insights/${shortCode}`);
    return response.data;
  },

  // Get personalized recommendations
  getRecommendations: async (): Promise<{
    success: boolean;
    data: PersonalizedRecommendation[];
  }> => {
    const response = await api.get("/api/v1/recommendations");
    return response.data;
  },

  // Create recommended link
  createRecommendedLink: async (
    recommendationId: string
  ): Promise<UrlResponse> => {
    const response = await api.post("/api/v1/recommendations/create", {
      recommendationId,
    });
    return response.data;
  },

  // Dismiss recommendation
  dismissRecommendation: async (
    recommendationId: string
  ): Promise<{ success: boolean }> => {
    const response = await api.delete(
      `/api/v1/recommendations/${recommendationId}`
    );
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get("/health");
    return response.data;
  },
};

export default urlService;
