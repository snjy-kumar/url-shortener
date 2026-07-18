import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">
        Page not found
      </h1>
      <p className="mt-2 text-muted">That route does not exist.</p>
      <Link href="/" className="mt-6 text-sea underline-offset-2 hover:underline">
        Back home
      </Link>
    </main>
  );
}
