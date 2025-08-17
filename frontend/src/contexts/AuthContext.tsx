"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { User } from "../types";
import { TokenManager } from "../lib/api";
import { AuthService } from "../services/urlService";
import toast from "react-hot-toast";

// ==================== AUTH CONTEXT TYPES ====================

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    name?: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

// ==================== AUTH CONTEXT ====================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==================== AUTH PROVIDER ====================

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize authentication state on mount
  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check if user is already authenticated
      const token = TokenManager.getToken();
      const savedUser = TokenManager.getUser();

      if (token && savedUser) {
        setUser(savedUser);
        setIsAuthenticated(true);
      } else {
        // No authentication data found
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      TokenManager.clearAll();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await AuthService.login({ email, password });

      if (response.success && response.data) {
        const { user: userData, token, refreshToken } = response.data;

        // Store authentication data
        TokenManager.setTokens(token, refreshToken);
        TokenManager.setUser(userData);

        // Update state
        setUser(userData);
        setIsAuthenticated(true);

        toast.success(response.message || "Login successful!");
        return true;
      } else {
        toast.error(response.message || "Login failed");
        return false;
      }
    } catch (error: unknown) {
      console.error("Login error:", error);
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Login failed. Please try again.";
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    name?: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await AuthService.register({ email, password, name });

      if (response.success && response.data) {
        const { user: userData, token, refreshToken } = response.data;

        // Store authentication data
        TokenManager.setTokens(token, refreshToken);
        TokenManager.setUser(userData);

        // Update state
        setUser(userData);
        setIsAuthenticated(true);

        toast.success(response.message || "Registration successful!");
        return true;
      } else {
        toast.error(response.message || "Registration failed");
        return false;
      }
    } catch (error: unknown) {
      console.error("Registration error:", error);
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Registration failed. Please try again.";
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Call logout endpoint if user is authenticated
      if (isAuthenticated) {
        try {
          await AuthService.logout();
        } catch (error) {
          // Even if logout fails on server, clear local data
          console.error("Server logout error:", error);
        }
      }

      // Clear all authentication data
      TokenManager.clearAll();

      // Update state
      setUser(null);
      setIsAuthenticated(false);

      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      // Force clear even on error
      TokenManager.clearAll();
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const refreshUserData = async (): Promise<void> => {
    try {
      // This would call a profile endpoint to get fresh user data
      // For now, we'll use the stored user data
      const savedUser = TokenManager.getUser();
      if (savedUser) {
        setUser(savedUser);
        setIsAuthenticated(true);
      } else {
        throw new Error("No user data found");
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      await logout();
      throw error;
    }
  };

  const updateUser = (userData: Partial<User>): void => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      TokenManager.setUser(updatedUser);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshUserData,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ==================== AUTH HOOK ====================

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// ==================== AUTH UTILITIES ====================

export const useAuthGuard = (redirectTo: string = "/auth/login") => {
  const { isAuthenticated, isLoading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setShouldRedirect(true);
    }
  }, [isAuthenticated, isLoading]);

  return {
    isAuthenticated,
    isLoading,
    shouldRedirect,
    redirectTo,
  };
};

export const useAuthRedirect = (redirectTo: string = "/dashboard") => {
  const { isAuthenticated, isLoading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setShouldRedirect(true);
    }
  }, [isAuthenticated, isLoading]);

  return {
    isAuthenticated,
    isLoading,
    shouldRedirect,
    redirectTo,
  };
};

// ==================== PROTECTED ROUTE COMPONENT ====================

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback = <div>Loading...</div>,
  redirectTo = "/auth/login",
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated) {
    // In a real app, you'd use Next.js router to redirect
    if (typeof window !== "undefined") {
      window.location.href = redirectTo;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default AuthContext;
