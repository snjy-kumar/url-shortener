import type { Url } from "@/types";

export type ExpiryPreset = "never" | "1h" | "24h" | "7d" | "30d" | "custom";

export const PRESET_TO_EXPIRES_IN: Record<
  Exclude<ExpiryPreset, "never" | "custom">,
  string
> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
};

export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString();
}

export function formatExpirySummary(url: Url): string {
  const parts: string[] = [];
  if (url.expiresAt) {
    parts.push(`until ${new Date(url.expiresAt).toLocaleString()}`);
  }
  if (url.maxClicks !== null) {
    parts.push(`max ${url.maxClicks} clicks`);
  }
  if (parts.length === 0) return "never";
  return parts.join(" · ");
}

export function statusLabel(url: Url): string {
  if (!url.isActive) return "disabled";
  if (url.isExpired) return "expired";
  return "active";
}

export function buildExpiryPayload(
  preset: ExpiryPreset,
  customAt: string,
  clicks: string
): {
  expiresAt?: string | null;
  expiresIn?: string | null;
  maxClicks?: number | null;
} {
  const payload: {
    expiresAt?: string | null;
    expiresIn?: string | null;
    maxClicks?: number | null;
  } = {};

  if (preset === "never") {
    payload.expiresAt = null;
  } else if (preset === "custom") {
    if (!customAt) {
      throw new Error("Pick a custom expiry datetime");
    }
    payload.expiresAt = fromDatetimeLocalValue(customAt);
  } else {
    payload.expiresIn = PRESET_TO_EXPIRES_IN[preset];
  }

  const trimmed = clicks.trim();
  if (trimmed === "") {
    payload.maxClicks = null;
  } else {
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("Max clicks must be a positive whole number");
    }
    payload.maxClicks = n;
  }

  return payload;
}
