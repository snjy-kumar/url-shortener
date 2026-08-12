"use client";

import { FormEvent, startTransition, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
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
import {
  buildExpiryPayload,
  formatExpirySummary,
  statusLabel,
  toDatetimeLocalValue,
  type ExpiryPreset,
} from "@/lib/expiry";
import { SiteHeader } from "@/components/SiteHeader";
import type { Url } from "@/types";

export default function DashboardPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
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
    if (!isLoaded || !isSignedIn) return;
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
        if (!cancelled) startTransition(() => setRecent([]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

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

  const onLookup = async (e: FormEvent) => {
    e.preventDefault();
    const code = lookupCode.trim();
    if (!code) return;
    await run(async () => {
      const data = await getShortUrl(getToken, code);
      syncManaged(data);
      setLookupCode("");
      await refreshRecent();
    });
  };

  const openRecent = (code: string) =>
    run(async () => {
      try {
        const data = await getShortUrl(getToken, code);
        syncManaged(data);
      } catch (err) {
        forgetCode(code);
        await refreshRecent();
        throw err;
      }
    });

  const copy = async () => {
    if (!managed) return;
    await navigator.clipboard.writeText(managed.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <SiteHeader title="Dashboard" />
      <p className="mt-3 text-lg text-muted">
        Manage your owned short links.
      </p>

      {!isLoaded ? (
        <p className="mt-8 text-sm text-muted">Loading…</p>
      ) : !isSignedIn ? (
        <p className="mt-8 text-sm text-muted">Sign in to view your dashboard.</p>
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
                  onClick={() => run(refreshRecent)}
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
                  Clicks:{" "}
                  <span className="text-ink">{managed.clickCount}</span>
                  {" · "}
                  Expiry:{" "}
                  <span className="text-ink">
                    {formatExpirySummary(managed)}
                  </span>
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
                    onClick={() =>
                      run(async () => {
                        const nextAlias = editAlias.trim();
                        if (!nextAlias) throw new Error("Alias cannot be empty");
                        const prev = managed.shortCode;
                        const data = await updateShortUrl(getToken, prev, {
                          customAlias: nextAlias,
                        });
                        renameRememberedCode(prev, data.shortCode);
                        syncManaged(data);
                        await refreshRecent();
                      })
                    }
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

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="edit-expiry"
                    className="mb-1.5 block text-sm text-muted"
                  >
                    Expires
                  </label>
                  <select
                    id="edit-expiry"
                    value={editExpiryPreset}
                    onChange={(e) =>
                      setEditExpiryPreset(e.target.value as ExpiryPreset)
                    }
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
                {editExpiryPreset === "custom" && (
                  <input
                    type="datetime-local"
                    value={editCustomExpiresAt}
                    onChange={(e) => setEditCustomExpiresAt(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
                  />
                )}
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={editMaxClicks}
                  onChange={(e) => setEditMaxClicks(e.target.value)}
                  placeholder="Max clicks (optional)"
                  className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !editUrl.trim()}
                  onClick={() =>
                    run(async () => {
                      const data = await updateShortUrl(
                        getToken,
                        managed.shortCode,
                        { originalUrl: editUrl.trim() }
                      );
                      syncManaged(data);
                      await refreshRecent();
                    })
                  }
                  className="rounded-md bg-sea px-3 py-1.5 text-sm font-medium text-white hover:bg-sea-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save destination
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const expiry = buildExpiryPayload(
                        editExpiryPreset,
                        editCustomExpiresAt,
                        editMaxClicks
                      );
                      const data = await updateShortUrl(
                        getToken,
                        managed.shortCode,
                        expiry
                      );
                      syncManaged(data);
                      await refreshRecent();
                    })
                  }
                  className="rounded-md bg-sea px-3 py-1.5 text-sm font-medium text-white hover:bg-sea-dark disabled:opacity-50"
                >
                  Save expiry
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const data = await updateShortUrl(
                        getToken,
                        managed.shortCode,
                        { isActive: !managed.isActive }
                      );
                      syncManaged(data);
                      await refreshRecent();
                    })
                  }
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-50"
                >
                  {managed.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const data = await getShortUrl(
                        getToken,
                        managed.shortCode
                      );
                      syncManaged(data);
                      await refreshRecent();
                    })
                  }
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-50"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const code = managed.shortCode;
                      await deleteShortUrl(getToken, code);
                      forgetCode(code);
                      setManaged(null);
                      await refreshRecent();
                    })
                  }
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
