export interface CreateUrlRequest {
  originalUrl: string;
  customAlias?: string;
}

export interface UpdateUrlRequest {
  originalUrl?: string;
  isActive?: boolean;
}

export interface Url {
  id: number;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: { field: string; message: string }[];
}
