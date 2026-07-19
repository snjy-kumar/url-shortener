declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export interface CreateUrlRequest {
  originalUrl: string;
  customAlias?: string;
}

export interface UpdateUrlRequest {
  originalUrl?: string;
  isActive?: boolean;
}

export interface UrlResponse {
  id: number;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}
