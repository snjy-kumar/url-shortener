import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import toast from "react-hot-toast";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Create axios instance with enhanced configuration
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: false,
});

// Token management utilities
class TokenManager {
  private static readonly TOKEN_KEY = "authToken";
  private static readonly REFRESH_TOKEN_KEY = "refreshToken";
  private static readonly USER_KEY = "user";

  static getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setTokens(token: string, refreshToken?: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.TOKEN_KEY, token);
    if (refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  static setUser(user: any): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static getUser(): any | null {
    if (typeof window === "undefined") return null;
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  static clearAll(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

// Request interceptor for authentication and security
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = TokenManager.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID for debugging
    config.headers["X-Request-ID"] = `req_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Add timestamp
    config.headers["X-Request-Time"] = new Date().toISOString();

    return config;
  },
  (error: AxiosError) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log successful responses in debug mode
    if (process.env.NEXT_PUBLIC_DEBUG === "true") {
      console.log(
        `✅ API Success: ${response.config.method?.toUpperCase()} ${
          response.config.url
        }`,
        {
          status: response.status,
          data: response.data,
        }
      );
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle different error scenarios
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - attempt token refresh
          if (!originalRequest._retry && TokenManager.getRefreshToken()) {
            originalRequest._retry = true;

            try {
              const refreshResponse = await axios.post(
                `${API_BASE_URL}/api/v1/auth/refresh`,
                { refreshToken: TokenManager.getRefreshToken() },
                { headers: { "Content-Type": "application/json" } }
              );

              const { token, refreshToken } = refreshResponse.data.data;
              TokenManager.setTokens(token, refreshToken);

              // Retry original request with new token
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return api(originalRequest);
            } catch (refreshError) {
              // Refresh failed - redirect to login
              TokenManager.clearAll();
              toast.error("Session expired. Please login again.");
              if (typeof window !== "undefined") {
                window.location.href = "/auth/login";
              }
            }
          } else {
            // No refresh token or refresh already tried
            TokenManager.clearAll();
            toast.error("Authentication required. Please login.");
            if (typeof window !== "undefined") {
              window.location.href = "/auth/login";
            }
          }
          break;

        case 403:
          toast.error("Access denied. Insufficient permissions.");
          break;

        case 404:
          toast.error("Resource not found.");
          break;

        case 422:
          // Validation errors
          const errorMessage = (data as any)?.message || "Validation failed.";
          const errors = (data as any)?.errors;
          if (errors && Array.isArray(errors)) {
            errors.forEach((err: any) => toast.error(err.message || err));
          } else {
            toast.error(errorMessage);
          }
          break;

        case 429:
          toast.error("Too many requests. Please try again later.");
          break;

        case 500:
          toast.error("Server error. Please try again later.");
          break;

        default:
          const message =
            (data as any)?.message || "An unexpected error occurred.";
          toast.error(message);
      }
    } else if (error.request) {
      // Network error
      toast.error("Network error. Please check your connection.");
    } else {
      // Other errors
      toast.error("An unexpected error occurred.");
    }

    // Log error in debug mode
    if (process.env.NEXT_PUBLIC_DEBUG === "true") {
      console.error(
        `❌ API Error: ${originalRequest.method?.toUpperCase()} ${
          originalRequest.url
        }`,
        {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        }
      );
    }

    return Promise.reject(error);
  }
);

// Export token manager for use in components
export { TokenManager };

export default api;
