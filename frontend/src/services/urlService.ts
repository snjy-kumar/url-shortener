import api from "@/lib/api";
import { CreateUrlRequest, UrlListResponse, UrlResponse } from "@/types";

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

  // Delete URL
  deleteUrl: async (
    shortCode: string
  ): Promise<{ success: boolean; message?: string }> => {
    const response = await api.delete(`/api/v1/urls/${shortCode}`);
    return response.data;
  },

  // Get analytics for a URL
  getUrlAnalytics: async (shortCode: string) => {
    // This will be implemented when backend analytics endpoint is ready
    const response = await api.get(`/api/v1/urls/${shortCode}/analytics`);
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get("/health");
    return response.data;
  },
};

export default urlService;
