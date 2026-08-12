export const renderPasswordGatePage = (
  shortCode: string,
  error?: string
): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Protected link</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f3f6f4; color: #1a2332;
      display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
    form { background: #fff; border: 1px solid #d5ddd8; border-radius: 12px; padding: 1.5rem;
      width: min(360px, 92vw); }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { color: #5c6b7a; font-size: 0.95rem; }
    input { width: 100%; box-sizing: border-box; padding: 0.75rem; margin: 0.75rem 0 1rem;
      border: 1px solid #d5ddd8; border-radius: 8px; }
    button { width: 100%; padding: 0.75rem; border: 0; border-radius: 8px;
      background: #1f6f5b; color: #fff; font-weight: 600; cursor: pointer; }
    .err { color: #b91c1c; font-size: 0.875rem; }
  </style>
</head>
<body>
  <form method="post" action="/${encodeURIComponent(shortCode)}/unlock">
    <h1>Protected short link</h1>
    <p>Enter the password to continue.</p>
    ${error ? `<p class="err">${error}</p>` : ''}
    <input type="password" name="password" required autofocus placeholder="Password" />
    <button type="submit">Unlock</button>
  </form>
</body>
</html>`;
