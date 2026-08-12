"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useAuth } from "@clerk/nextjs";
import { claimShortUrl, createShortUrl } from "@/lib/api";
import {
  buildExpiryPayload,
  type ExpiryPreset,
} from "@/lib/expiry";
import {
  clearClaimToken,
  listPendingClaims,
  saveClaimToken,
} from "@/lib/claims";
import { SiteHeader } from "@/components/SiteHeader";
import type { Url } from "@/types";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function Home() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("never");
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<Url | null>(null);
  const [pendingClaims, setPendingClaims] = useState(listPendingClaims());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileRef.current || !window.turnstile) {
      return;
    }
    if (widgetId.current) return;
    widgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(null),
    });
  }, []);

  const onTurnstileLoad = () => {
    if (!TURNSTILE_SITE_KEY || !turnstileRef.current || !window.turnstile) {
      return;
    }
    if (widgetId.current) return;
    widgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(null),
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCopied(false);
    setLoading(true);
    try {
      if (!isSignedIn && TURNSTILE_SITE_KEY && !turnstileToken) {
        throw new Error("Complete the CAPTCHA first");
      }
      const expiry = buildExpiryPayload(
        expiryPreset,
        customExpiresAt,
        maxClicks
      );
      const data = await createShortUrl(isSignedIn ? getToken : undefined, {
        originalUrl: url.trim(),
        customAlias: alias.trim() || undefined,
        turnstileToken: turnstileToken || undefined,
        password: password.trim() || undefined,
        ...expiry,
      });
      if (data.claimToken) {
        saveClaimToken(data.shortCode, data.claimToken);
        setPendingClaims(listPendingClaims());
      }
      setResult(data);
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
        setTurnstileToken(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const claimPending = async (shortCode: string, claimToken: string) => {
    if (!isSignedIn) return;
    setError(null);
    setLoading(true);
    try {
      await claimShortUrl(getToken, shortCode, claimToken);
      clearClaimToken(shortCode);
      setPendingClaims(listPendingClaims());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={onTurnstileLoad}
        />
      )}
      <SiteHeader />
      <p className="mt-3 max-w-md text-lg text-muted">
        Paste a long URL. Get a short one. Sign in to manage links on the
        dashboard.
      </p>

      {!isLoaded ? (
        <p className="mt-8 text-sm text-muted">Loading…</p>
      ) : (
        <>
          {isSignedIn && pendingClaims.length > 0 && (
            <section className="mt-8 rounded-lg border border-line bg-white p-4">
              <p className="mb-2 text-sm text-muted">Claim guest links</p>
              <ul className="space-y-2">
                {pendingClaims.map((item) => (
                  <li
                    key={item.shortCode}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="font-medium text-sea">{item.shortCode}</span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        claimPending(item.shortCode, item.claimToken)
                      }
                      className="rounded-md bg-sea px-3 py-1.5 text-sm font-medium text-white hover:bg-sea-dark disabled:opacity-50"
                    >
                      Claim
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

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

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="create-expiry"
                  className="mb-1.5 block text-sm text-muted"
                >
                  Expires
                </label>
                <select
                  id="create-expiry"
                  value={expiryPreset}
                  onChange={(e) =>
                    setExpiryPreset(e.target.value as ExpiryPreset)
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

              {expiryPreset === "custom" && (
                <input
                  type="datetime-local"
                  value={customExpiresAt}
                  onChange={(e) => setCustomExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
                />
              )}

              <input
                type="number"
                min={1}
                step={1}
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
                placeholder="Max clicks (optional)"
                className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password gate (optional)"
                className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none ring-sea/30 focus:ring-2"
              />
            </div>

            {!isSignedIn && TURNSTILE_SITE_KEY && (
              <div ref={turnstileRef} className="min-h-[65px]" />
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

          {result && (
            <div className="mt-6 space-y-3 rounded-lg border border-line bg-white p-4">
              <p className="text-sm text-muted">Your short link</p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={result.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-sea underline-offset-2 hover:underline"
                >
                  {result.shortUrl}
                </a>
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {result.claimToken && (
                <p className="text-sm text-muted">
                  Claim token saved in this browser. Sign in and claim to manage
                  it.
                </p>
              )}
              {isSignedIn ? (
                <p className="text-sm text-muted">
                  <Link
                    href="/dashboard"
                    className="text-sea underline-offset-2 hover:underline"
                  >
                    Open dashboard
                  </Link>{" "}
                  to manage this link.
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Sign in next time to save and manage links.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
