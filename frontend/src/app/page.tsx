"use client";

import { FormEvent, useState } from "react";
import {
  createShortUrl,
  deleteShortUrl,
  getShortUrl,
  updateShortUrl,
} from "@/lib/api";
import type { Url } from "@/types";

export default function Home() {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [managed, setManaged] = useState<Url | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setManaged(null);
    setCopied(false);
    setLoading(true);
    try {
      const data = await createShortUrl({
        originalUrl: url.trim(),
        customAlias: alias.trim() || undefined,
      });
      setManaged(data);
      setEditUrl(data.originalUrl);
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
      setEditUrl(data.originalUrl);
    });

  const toggleActive = () =>
    run(async () => {
      if (!managed) return;
      const data = await updateShortUrl(managed.shortCode, {
        isActive: !managed.isActive,
      });
      setManaged(data);
    });

  const refreshClicks = () =>
    run(async () => {
      if (!managed) return;
      const data = await getShortUrl(managed.shortCode);
      setManaged(data);
      setEditUrl(data.originalUrl);
    });

  const remove = () =>
    run(async () => {
      if (!managed) return;
      await deleteShortUrl(managed.shortCode);
      setManaged(null);
      setEditUrl("");
    });

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
                {managed.isActive ? "active" : "disabled"}
              </span>
              {" · "}
              Clicks: <span className="text-ink">{managed.clickCount}</span>
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
              Refresh clicks
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
