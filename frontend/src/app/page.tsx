"use client";

import { FormEvent, useState } from "react";
import { createShortUrl } from "@/lib/api";

export default function Home() {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setShortUrl(null);
    setCopied(false);
    setLoading(true);
    try {
      const data = await createShortUrl({
        originalUrl: url.trim(),
        customAlias: alias.trim() || undefined,
      });
      setShortUrl(data.shortUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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

      {shortUrl && (
        <div className="mt-6 rounded-lg border border-line bg-white p-4">
          <p className="text-sm text-muted">Your short link</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a
              href={shortUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all font-medium text-sea underline-offset-2 hover:underline"
            >
              {shortUrl}
            </a>
            <button
              type="button"
              onClick={copy}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
