import type {
  ApiResponse,
  CreateUrlRequest,
  UpdateUrlRequest,
  Url,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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
  body: CreateUrlRequest
): Promise<Url> {
  const res = await fetch(`${API_BASE}/api/v1/urls/shorten`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseUrlResponse(res);
}

export async function listShortUrls(
  limit = 50,
  offset = 0
): Promise<{ items: Url[]; total: number }> {
  const res = await fetch(
    `${API_BASE}/api/v1/urls?limit=${limit}&offset=${offset}`,
    { headers: { Accept: "application/json" } }
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

export async function getShortUrl(shortCode: string): Promise<Url> {
  const res = await fetch(`${API_BASE}/api/v1/urls/${shortCode}`, {
    headers: { Accept: "application/json" },
  });

  return parseUrlResponse(res);
}

export async function updateShortUrl(
  shortCode: string,
  body: UpdateUrlRequest
): Promise<Url> {
  const res = await fetch(`${API_BASE}/api/v1/urls/${shortCode}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseUrlResponse(res);
}

export async function deleteShortUrl(shortCode: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/urls/${shortCode}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  const json = (await res.json()) as ApiResponse;

  if (!res.ok || !json.success) {
    const detail =
      json.errors?.[0]?.message || json.message || "Request failed";
    throw new Error(detail);
  }
}
