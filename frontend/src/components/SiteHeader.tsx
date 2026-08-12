"use client";

import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAdminMe } from "@/lib/api";

type SiteHeaderProps = {
  title?: string;
};

export function SiteHeader({ title = "Shortlink" }: SiteHeaderProps) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchAdminMe(getToken);
        if (!cancelled) setIsAdmin(me.isAdmin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-ink sm:text-5xl"
        >
          {title}
        </Link>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-1">
        <Show when="signed-in">
          <Link
            href="/dashboard"
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
          >
            Dashboard
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
            >
              Admin
            </Link>
          )}
          <UserButton />
        </Show>
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
      </div>
    </div>
  );
}
