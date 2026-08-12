"use client";

import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { FormEvent, startTransition, useEffect, useState } from "react";
import {
  createShortUrl,
  deleteShortUrl,
  getShortUrl,
  listShortUrls,
  updateShortUrl,
} from "@/lib/api";
import {
  forgetCode,
  rememberCode,
  renameRememberedCode,
} from "@/lib/recent";
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

function statusLabel(url: Url): string {
  if (!url.isActive) return "disabled";
  if (url.isExpired) return "expired";
  return "active";
}

export default function Home() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("never");
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [managed, setManaged] = useState<Url | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editAlias, setEditAlias] = useState("");
  const [editExpiryPreset, setEditExpiryPreset] =
    useState<ExpiryPreset>("never");
  const [editCustomExpiresAt, setEditCustomExpiresAt] = useState("");
  const [editMaxClicks, setEditMaxClicks] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [recent, setRecent] = useState<Url[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const syncManaged = (data: Url) => {
    setManaged(data);
    setEditUrl(data.originalUrl);
    setEditAlias(data.shortCode);
    setEditMaxClicks(data.maxClicks !== null ? String(data.maxClicks) : "");
    if (data.expiresAt) {
      setEditExpiryPreset("custom");
      setEditCustomExpiresAt(toDatetimeLocalValue(data.expiresAt));
    } else {
      setEditExpiryPreset("never");
      setEditCustomExpiresAt("");
    }
    rememberCode(data.shortCode);
  };

  const refreshRecent = async () => {
    if (!isSignedIn) {
      startTransition(() => setRecent([]));
      return;
    }
    try {
      const { items } = await listShortUrls(getToken, 30, 0);
      for (const item of items) {
        rememberCode(item.shortCode);
      }
      startTransition(() => setRecent(items));
    } catch {
      startTransition(() => setRecent([]));
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      startTransition(() => {
        setRecent([]);
        setManaged(null);
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { items } = await listShortUrls(getToken, 30, 0);
        if (cancelled) return;
        for (const item of items) {
          rememberCode(item.shortCode);
        }
        startTransition(() => setRecent(items));
      } catch {
        if (!cancelled) {
          startTransition(() => setRecent([]));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

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
      const data = await createShortUrl(getToken, {
        originalUrl: url.trim(),
        customAlias: alias.trim() || undefined,
        ...expiry,
      });
      syncManaged(data);
      await refreshRecent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onLookup = async (e: FormEvent) => {
    e.preventDefault();
    const code = lookupCode.trim();
    if (!code) return;
    setError(null);
    setCopied(false);
    setBusy(true);
    try {
      const data = await getShortUrl(getToken, code);
      syncManaged(data);
      setLookupCode("");
      await refreshRecent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const openRecent = async (code: string) => {
    setError(null);
    setCopied(false);
    setBusy(true);
    try {
      const data = await getShortUrl(getToken, code);
      syncManaged(data);
    } catch (err) {
      forgetCode(code);
      await refreshRecent();
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const syncFromServerList = async () => {
    setError(null);
    setBusy(true);
    try {
      const { items } = await listShortUrls(getToken, 30, 0);
      for (const item of items) {
        rememberCode(item.shortCode);
      }
      startTransition(() => setRecent(items));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
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
      const data = await updateShortUrl(getToken, managed.shortCode, {
        originalUrl: editUrl.trim(),
      });
      syncManaged(data);
      await refreshRecent();
    });

  const saveAlias = () =>
    run(async () => {
      if (!managed) return;
      const nextAlias = editAlias.trim();
      if (!nextAlias) {
        throw new Error("Alias cannot be empty");
      }
      const prev = managed.shortCode;
      const data = await updateShortUrl(getToken, prev, {
        customAlias: nextAlias,
      });
      renameRememberedCode(prev, data.shortCode);
      syncManaged(data);
      await refreshRecent();
    });

  const saveExpiry = () =>
    run(async () => {
      if (!managed) return;
      const expiry = buildExpiryPayload(
        editExpiryPreset,
        editCustomExpiresAt,
        editMaxClicks
      );
      const data = await updateShortUrl(getToken, managed.shortCode, expiry);
      syncManaged(data);
      await refreshRecent();
    });

  const toggleActive = () =>
    run(async () => {
      if (!managed) return;
      const data = await updateShortUrl(getToken, managed.shortCode, {
        isActive: !managed.isActive,
      });
      syncManaged(data);
      await refreshRecent();
    });

  const refreshClicks = () =>
    run(async () => {
      if (!managed) return;
      const data = await getShortUrl(getToken, managed.shortCode);
      syncManaged(data);
      await refreshRecent();
    });

  const remove = () =>
    run(async () => {
      if (!managed) return;
      const code = managed.shortCode;
      await deleteShortUrl(getToken, code);
      forgetCode(code);
      setManaged(null);
      setEditUrl("");
      setEditAlias("");
      setEditExpiryPreset("never");
      setEditCustomExpiresAt("");
      setEditMaxClicks("");
      await refreshRecent();
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
      <div className="flex items-start justify-between gap-4">
        <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-ink sm:text-5xl">
          Shortlink
        </p>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-lg bg-sea px-3 py-1.5 text-sm font-medium text-white hover:bg-sea-dark"
              >
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
      <p className="mt-3 max-w-md text-lg text-muted">
        Paste a long URL. Get a short one.
      </p>

      {!isLoaded ? (
        <p className="mt-8 text-sm text-muted">Loading…</p>
      ) : !isSignedIn ? (
        <div className="mt-8 rounded-lg border border-line bg-white p-6">
          <p className="text-ink">Sign in to create and manage short links.</p>
          <div className="mt-4 flex gap-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-paper"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-lg bg-sea px-4 py-2 text-sm font-medium text-white hover:bg-sea-dark"
              >
                Sign up
              </button>
            </SignUpButton>
          </div>
        </div>
      ) : (
        <>
      <form onSubmit={onLookup} className="mt-8 flex gap-2">
        <input
          id="lookup"
          type="text"
          value={lookupCode}
          onChange={(e) => setLookupCode(e.target.value)}
          placeholder="Load by short code"
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy || !lookupCode.trim()}
          className="shrink-0 rounded-lg border border-line px-4 py-3 text-sm text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          Load
        </button>
      </form>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
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

      {recent.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">Your links</p>
            <button
              type="button"
              disabled={busy}
              onClick={syncFromServerList}
              className="text-sm text-sea underline-offset-2 hover:underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {recent.map((item) => (
              <li key={item.shortCode}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openRecent(item.shortCode)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper disabled:opacity-50"
                >
                  <span className="min-w-0 truncate font-medium text-sea">
                    {item.shortCode}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {statusLabel(item)} · {item.clickCount} clicks
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
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
              <span className="text-ink">{statusLabel(managed)}</span>
              {" · "}
              Clicks: <span className="text-ink">{managed.clickCount}</span>
              {" · "}
              Expiry:{" "}
              <span className="text-ink">{formatExpirySummary(managed)}</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-alias"
              className="mb-1.5 block text-sm text-muted"
            >
              Alias
            </label>
            <div className="flex gap-2">
              <input
                id="edit-alias"
                type="text"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
              />
              <button
                type="button"
                disabled={
                  busy ||
                  !editAlias.trim() ||
                  editAlias.trim().toLowerCase() === managed.shortCode
                }
                onClick={saveAlias}
                className="shrink-0 rounded-md bg-sea px-3 py-1.5 text-sm font-medium text-white hover:bg-sea-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Rename
              </button>
            </div>
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
        </>
      )}
    </main>
  );
}
