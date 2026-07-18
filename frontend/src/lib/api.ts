import type { ApiResponse, CreateUrlRequest, Url } from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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

  const json = (await res.json()) as ApiResponse<Url>;

  if (!res.ok || !json.success || !json.data) {
    const detail = json.errors?.[0]?.message || json.message || "Request failed";
    throw new Error(detail);
  }

  return json.data;
}
