import type {
  ApiResponse,
  CreateUrlRequest,
  UpdateUrlRequest,
  Url,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export type GetToken = () => Promise<string | null>;

async function authHeaders(
  getToken: GetToken,
  extra?: Record<string, string>
): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) {
    throw new Error("Sign in required");
  }
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function optionalAuthHeaders(
  getToken: GetToken | undefined,
  extra?: Record<string, string>
): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extra,
  };
  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

async function parseUrlResponse(res: Response): Promise<Url> {
  const json = (await res.json()) as ApiResponse<Url>;

  if (!res.ok || !json.success || !json.data) {
    const detail =
      json.errors?.[0]?.message || json.message || "Request failed";
    throw new Error(detail);
  }

  return json.data;
}

export async function createShortUrl(
  getToken: GetToken | undefined,
  body: CreateUrlRequest
): Promise<Url> {
  const res = await fetch(`${API_BASE}/api/v1/urls/shorten`, {
    method: "POST",
    headers: await optionalAuthHeaders(getToken, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });

  return parseUrlResponse(res);
}

export async function listShortUrls(
  getToken: GetToken,
  limit = 50,
  offset = 0
): Promise<{ items: Url[]; total: number }> {
  const res = await fetch(
    `${API_BASE}/api/v1/urls?limit=${limit}&offset=${offset}`,
    { headers: await authHeaders(getToken) }
  );

  const json = (await res.json()) as ApiResponse<{
    items: Url[];
    total: number;
  }>;

  if (!res.ok || !json.success || !json.data) {
    const detail =
      json.errors?.[0]?.message || json.message || "Request failed";
    throw new Error(detail);
  }

  return json.data;
}

export async function getShortUrl(
  getToken: GetToken,
  shortCode: string
): Promise<Url> {
  const res = await fetch(`${API_BASE}/api/v1/urls/${shortCode}`, {
    headers: await authHeaders(getToken),
  });

  return parseUrlResponse(res);
}

export async function updateShortUrl(
  getToken: GetToken,
  shortCode: string,
  body: UpdateUrlRequest
): Promise<Url> {
  const res = await fetch(`${API_BASE}/api/v1/urls/${shortCode}`, {
    method: "PATCH",
    headers: await authHeaders(getToken, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });

  return parseUrlResponse(res);
}

export async function deleteShortUrl(
  getToken: GetToken,
  shortCode: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/urls/${shortCode}`, {
    method: "DELETE",
    headers: await authHeaders(getToken),
  });

  const json = (await res.json()) as ApiResponse;

  if (!res.ok || !json.success) {
    const detail =
      json.errors?.[0]?.message || json.message || "Request failed";
    throw new Error(detail);
  }
}

export type AdminUrl = Url & { clerkUserId: string | null };

export type AdminMetrics = {
  uptimeSeconds: number;
  redirects: {
    total: number;
    hits: number;
    misses: number;
    errors: number;
  };
  rateLimit429: number;
  redirectLatencyMs: {
    samples: number;
    avg: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  };
  services: { database: string };
  redirectCache?: string;
};

export async function claimShortUrl(
  getToken: GetToken,
  shortCode: string,
  claimToken: string
): Promise<Url> {
  const res = await fetch(`${API_BASE}/api/v1/urls/${shortCode}/claim`, {
    method: "POST",
    headers: await authHeaders(getToken, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ claimToken }),
  });
  return parseUrlResponse(res);
}

export async function fetchUrlAnalytics(
  getToken: GetToken,
  shortCode: string,
  limit = 50
): Promise<{
  shortCode: string;
  totalClicks: number;
  recent: Array<{
    id: string;
    createdAt: string;
    referrer: string | null;
    userAgent: string | null;
  }>;
}> {
  const res = await fetch(
    `${API_BASE}/api/v1/urls/${shortCode}/analytics?limit=${limit}`,
    { headers: await authHeaders(getToken) }
  );
  const json = (await res.json()) as ApiResponse<{
    shortCode: string;
    totalClicks: number;
    recent: Array<{
      id: string;
      createdAt: string;
      referrer: string | null;
      userAgent: string | null;
    }>;
  }>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || "Analytics failed");
  }
  return json.data;
}

export async function fetchAdminAudit(
  getToken: GetToken,
  limit = 50
): Promise<
  Array<{
    id: number;
    adminUserId: string;
    action: string;
    shortCode: string;
    meta: unknown;
    createdAt: string;
  }>
> {
  const res = await fetch(`${API_BASE}/api/v1/admin/audit?limit=${limit}`, {
    headers: await authHeaders(getToken),
  });
  const json = (await res.json()) as ApiResponse<
    Array<{
      id: number;
      adminUserId: string;
      action: string;
      shortCode: string;
      meta: unknown;
      createdAt: string;
    }>
  >;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || "Audit failed");
  }
  return json.data;
}

export async function fetchAdminMe(
  getToken: GetToken
): Promise<{ isAdmin: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/me`, {
    headers: await authHeaders(getToken),
  });
  const json = (await res.json()) as ApiResponse<{ isAdmin: boolean }>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || "Admin me failed");
  }
  return json.data;
}

export async function fetchAdminMetrics(
  getToken: GetToken
): Promise<AdminMetrics> {
  const res = await fetch(`${API_BASE}/api/v1/admin/metrics`, {
    headers: await authHeaders(getToken),
  });
  const json = (await res.json()) as ApiResponse<AdminMetrics>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || "Metrics failed");
  }
  return json.data;
}

export async function adminGetUrl(
  getToken: GetToken,
  shortCode: string
): Promise<AdminUrl> {
  const res = await fetch(`${API_BASE}/api/v1/admin/urls/${shortCode}`, {
    headers: await authHeaders(getToken),
  });
  const json = (await res.json()) as ApiResponse<AdminUrl>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || "Admin lookup failed");
  }
  return json.data;
}

export async function adminDisableUrl(
  getToken: GetToken,
  shortCode: string
): Promise<AdminUrl> {
  const res = await fetch(
    `${API_BASE}/api/v1/admin/urls/${shortCode}/disable`,
    {
      method: "POST",
      headers: await authHeaders(getToken),
    }
  );
  const json = (await res.json()) as ApiResponse<AdminUrl>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || "Admin disable failed");
  }
  return json.data;
}
