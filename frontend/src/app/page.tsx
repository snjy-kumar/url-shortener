"use client";

import { FormEvent, useState } from "react";
import {
  createShortUrl,
  deleteShortUrl,
  getShortUrl,
  updateShortUrl,
} from "@/lib/api";
import type { Url } from "@/types";

type ExpiryPreset = "never" | "1h" | "24h" | "7d" | "30d" | "custom";

const PRESET_TO_EXPIRES_IN: Record<Exclude<ExpiryPreset, "never" | "custom">, string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString();
}

function formatExpirySummary(url: Url): string {
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("never");
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [managed, setManaged] = useState<Url | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editExpiryPreset, setEditExpiryPreset] =
    useState<ExpiryPreset>("never");
  const [editCustomExpiresAt, setEditCustomExpiresAt] = useState("");
  const [editMaxClicks, setEditMaxClicks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildExpiryPayload = (
    preset: ExpiryPreset,
    customAt: string,
    clicks: string
  ): {
    expiresAt?: string | null;
    expiresIn?: string | null;
    maxClicks?: number | null;
  } => {
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
  };

  const syncEditExpiryFromUrl = (data: Url) => {
    setEditUrl(data.originalUrl);
    setEditMaxClicks(data.maxClicks !== null ? String(data.maxClicks) : "");
    if (data.expiresAt) {
      setEditExpiryPreset("custom");
      setEditCustomExpiresAt(toDatetimeLocalValue(data.expiresAt));
    } else {
      setEditExpiryPreset("never");
      setEditCustomExpiresAt("");
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setManaged(null);
    setCopied(false);
    setLoading(true);
    try {
      const expiry = buildExpiryPayload(
        expiryPreset,
        customExpiresAt,
        maxClicks
      );
      const data = await createShortUrl({
        originalUrl: url.trim(),
        customAlias: alias.trim() || undefined,
        ...expiry,
      });
      setManaged(data);
      syncEditExpiryFromUrl(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!managed) return;
    await navigator.clipboard.writeText(managed.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const saveDestination = () =>
    run(async () => {
      if (!managed) return;
      const data = await updateShortUrl(managed.shortCode, {
        originalUrl: editUrl.trim(),
      });
      setManaged(data);
      syncEditExpiryFromUrl(data);
    });

  const saveExpiry = () =>
    run(async () => {
      if (!managed) return;
      const expiry = buildExpiryPayload(
        editExpiryPreset,
        editCustomExpiresAt,
        editMaxClicks
      );
      const data = await updateShortUrl(managed.shortCode, expiry);
      setManaged(data);
      syncEditExpiryFromUrl(data);
    });

  const toggleActive = () =>
    run(async () => {
      if (!managed) return;
      const data = await updateShortUrl(managed.shortCode, {
        isActive: !managed.isActive,
      });
      setManaged(data);
      syncEditExpiryFromUrl(data);
    });

  const refreshClicks = () =>
    run(async () => {
      if (!managed) return;
      const data = await getShortUrl(managed.shortCode);
      setManaged(data);
      syncEditExpiryFromUrl(data);
    });

  const remove = () =>
    run(async () => {
      if (!managed) return;
      await deleteShortUrl(managed.shortCode);
      setManaged(null);
      setEditUrl("");
      setEditExpiryPreset("never");
      setEditCustomExpiresAt("");
      setEditMaxClicks("");
    });

  const expiryFields = (
    idPrefix: string,
    preset: ExpiryPreset,
    setPreset: (v: ExpiryPreset) => void,
    customAt: string,
    setCustomAt: (v: string) => void,
    clicks: string,
    setClicks: (v: string) => void
  ) => (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={`${idPrefix}-expiry`}
          className="mb-1.5 block text-sm text-muted"
        >
          Expires
        </label>
        <select
          id={`${idPrefix}-expiry`}
          value={preset}
          onChange={(e) => setPreset(e.target.value as ExpiryPreset)}
          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
        >
          <option value="never">Never</option>
          <option value="1h">In 1 hour</option>
          <option value="24h">In 24 hours</option>
          <option value="7d">In 7 days</option>
          <option value="30d">In 30 days</option>
          <option value="custom">Custom datetime</option>
        </select>
      </div>

      {preset === "custom" && (
        <div>
          <label
            htmlFor={`${idPrefix}-custom-at`}
            className="mb-1.5 block text-sm text-muted"
          >
            Exact expiry
          </label>
          <input
            id={`${idPrefix}-custom-at`}
            type="datetime-local"
            value={customAt}
            onChange={(e) => setCustomAt(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
          />
        </div>
      )}

      <div>
        <label
          htmlFor={`${idPrefix}-max-clicks`}
          className="mb-1.5 block text-sm text-muted"
        >
          Max clicks <span className="opacity-70">(optional)</span>
        </label>
        <input
          id={`${idPrefix}-max-clicks`}
          type="number"
          min={1}
          step={1}
          value={clicks}
          onChange={(e) => setClicks(e.target.value)}
          placeholder="Unlimited"
          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
        />
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-ink sm:text-5xl">
        Shortlink
      </p>
      <p className="mt-3 max-w-md text-lg text-muted">
        Paste a long URL. Get a short one.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-4">
        <div>
          <label htmlFor="url" className="mb-1.5 block text-sm text-muted">
            Long URL
          </label>
          <input
            id="url"
            type="text"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/very/long/path"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
          />
        </div>

        <div>
          <label htmlFor="alias" className="mb-1.5 block text-sm text-muted">
            Custom alias <span className="opacity-70">(optional)</span>
          </label>
          <input
            id="alias"
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="my-link"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
          />
        </div>

        {expiryFields(
          "create",
          expiryPreset,
          setExpiryPreset,
          customExpiresAt,
          setCustomExpiresAt,
          maxClicks,
          setMaxClicks
        )}

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full rounded-lg bg-sea px-4 py-3 font-medium text-white transition hover:bg-sea-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Shortening…" : "Shorten"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {managed && (
        <div className="mt-6 space-y-4 rounded-lg border border-line bg-white p-4">
          <div>
            <p className="text-sm text-muted">Your short link</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a
                href={managed.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all font-medium text-sea underline-offset-2 hover:underline"
              >
                {managed.shortUrl}
              </a>
              <button
                type="button"
                onClick={copy}
                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Status:{" "}
              <span className="text-ink">
                {!managed.isActive
                  ? "disabled"
                  : managed.isExpired
                    ? "expired"
                    : "active"}
              </span>
              {" · "}
              Clicks: <span className="text-ink">{managed.clickCount}</span>
              {" · "}
              Expiry:{" "}
              <span className="text-ink">{formatExpirySummary(managed)}</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-url"
              className="mb-1.5 block text-sm text-muted"
            >
              Destination
            </label>
            <input
              id="edit-url"
              type="text"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
            />
          </div>

          {expiryFields(
            "edit",
            editExpiryPreset,
            setEditExpiryPreset,
            editCustomExpiresAt,
            setEditCustomExpiresAt,
            editMaxClicks,
            setEditMaxClicks
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !editUrl.trim()}
              onClick={saveDestination}
              className="rounded-md bg-sea px-3 py-1.5 text-sm font-medium text-white hover:bg-sea-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save destination
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={saveExpiry}
              className="rounded-md bg-sea px-3 py-1.5 text-sm font-medium text-white hover:bg-sea-dark disabled:opacity-50"
            >
              Save expiry
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={toggleActive}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-50"
            >
              {managed.isActive ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={refreshClicks}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
