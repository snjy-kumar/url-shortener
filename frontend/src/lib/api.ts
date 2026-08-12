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
