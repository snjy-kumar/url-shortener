import { config } from '../config/env.js';

export type DeadLinkReason = 'not_found' | 'disabled' | 'expired';

const TITLES: Record<DeadLinkReason, string> = {
  not_found: 'Link not found',
  disabled: 'Link disabled',
  expired: 'Link expired',
};

const MESSAGES: Record<DeadLinkReason, string> = {
  not_found: 'This short link does not exist.',
  disabled: 'This short link has been disabled by its owner.',
  expired: 'This short link has expired or reached its click limit.',
};

export const deadLinkMessage = (reason: DeadLinkReason): string =>
  MESSAGES[reason];

const homeHref = (): string => {
  const origin = config.CORS_ORIGIN.split(',')[0]?.trim();
  if (origin && origin !== '*') {
    return origin;
  }
  return config.BASE_URL;
};

export const renderDeadLinkPage = (reason: DeadLinkReason): string => {
  const title = TITLES[reason];
  const message = MESSAGES[reason];
  const home = homeHref();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Shortlink</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Georgia, "Times New Roman", serif;
      background: #f6f3ee;
      color: #1c1917;
    }
    main {
      max-width: 28rem;
      padding: 2rem 1.5rem;
      text-align: center;
    }
    h1 {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0.75rem 0 0;
      color: #57534e;
      font-family: system-ui, sans-serif;
      font-size: 1rem;
      line-height: 1.5;
    }
    a {
      display: inline-block;
      margin-top: 1.5rem;
      color: #0f766e;
      font-family: system-ui, sans-serif;
      text-underline-offset: 3px;
    }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="${home}">Go home</a></p>
  </main>
</body>
</html>`;
};
