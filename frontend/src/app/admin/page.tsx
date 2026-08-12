"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  adminDisableUrl,
  adminGetUrl,
  fetchAdminMe,
  fetchAdminMetrics,
  type AdminMetrics,
  type AdminUrl,
} from "@/lib/api";
import { formatExpirySummary, statusLabel } from "@/lib/expiry";
import { SiteHeader } from "@/components/SiteHeader";

export default function AdminPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [code, setCode] = useState("");
  const [lookedUp, setLookedUp] = useState<AdminUrl | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchAdminMe(getToken);
        if (cancelled) return;
        setIsAdmin(me.isAdmin);
        if (me.isAdmin) {
          const m = await fetchAdminMetrics(getToken);
          if (!cancelled) setMetrics(m);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const onLookup = async (e: FormEvent) => {
    e.preventDefault();
    const shortCode = code.trim();
    if (!shortCode) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const data = await adminGetUrl(getToken, shortCode);
      setLookedUp(data);
    } catch (err) {
      setLookedUp(null);
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    if (!lookedUp) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const data = await adminDisableUrl(getToken, lookedUp.shortCode);
      setLookedUp(data);
      setMessage("Link disabled (takedown).");
      const m = await fetchAdminMetrics(getToken);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disable failed");
    } finally {
      setBusy(false);
    }
  };

  const refreshMetrics = async () => {
    setBusy(true);
    setError(null);
    try {
      const m = await fetchAdminMetrics(getToken);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Metrics failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <SiteHeader title="Admin" />
      <p className="mt-3 text-lg text-muted">
        Takedown links and view process metrics.
      </p>

      {!isLoaded ? (
        <p className="mt-8 text-sm text-muted">Loading…</p>
      ) : !isSignedIn ? (
        <p className="mt-8 text-sm text-muted">Sign in required.</p>
      ) : !isAdmin ? (
        <p className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Forbidden — your Clerk user is not in ADMIN_CLERK_USER_IDS.
        </p>
      ) : (
        <>
          {metrics && (
            <section className="mt-8 rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Process metrics</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={refreshMetrics}
                  className="text-sm text-sea underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted">Uptime</dt>
                  <dd className="text-ink">{metrics.uptimeSeconds}s</dd>
                </div>
                <div>
                  <dt className="text-muted">DB</dt>
                  <dd className="text-ink">{metrics.services.database}</dd>
                </div>
                <div>
                  <dt className="text-muted">Redirects</dt>
                  <dd className="text-ink">{metrics.redirects.total}</dd>
                </div>
                <div>
                  <dt className="text-muted">Hits / misses</dt>
                  <dd className="text-ink">
                    {metrics.redirects.hits} / {metrics.redirects.misses}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">429s</dt>
                  <dd className="text-ink">{metrics.rateLimit429}</dd>
                </div>
                <div>
                  <dt className="text-muted">Latency p50 / p95</dt>
                  <dd className="text-ink">
                    {metrics.redirectLatencyMs.p50 ?? "—"} /{" "}
                    {metrics.redirectLatencyMs.p95 ?? "—"} ms
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <form onSubmit={onLookup} className="mt-8 flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Short code to inspect"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="shrink-0 rounded-lg border border-line px-4 py-3 text-sm text-ink hover:bg-paper disabled:opacity-50"
            >
              Lookup
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-4 rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink">
              {message}
            </p>
          )}

          {lookedUp && (
            <div className="mt-6 space-y-3 rounded-lg border border-line bg-white p-4">
              <p className="break-all font-medium text-sea">
                {lookedUp.shortUrl}
              </p>
              <p className="text-sm text-muted">
                Status:{" "}
                <span className="text-ink">{statusLabel(lookedUp)}</span>
                {" · "}
                Clicks:{" "}
                <span className="text-ink">{lookedUp.clickCount}</span>
                {" · "}
                Expiry:{" "}
                <span className="text-ink">
                  {formatExpirySummary(lookedUp)}
                </span>
              </p>
              <p className="text-sm text-muted">
                Owner:{" "}
                <span className="text-ink">
                  {lookedUp.clerkUserId ?? "(anonymous)"}
                </span>
              </p>
              <p className="break-all text-sm text-muted">
                → {lookedUp.originalUrl}
              </p>
              <button
                type="button"
                disabled={busy || !lookedUp.isActive}
                onClick={onDisable}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lookedUp.isActive ? "Disable (takedown)" : "Already disabled"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
