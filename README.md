# Shortlink — URL Shortener

Full-stack URL shortener: Next.js UI + Express API + PostgreSQL + Clerk.

## Features

- Paste a long URL → get a short link (**guest or signed-in**)
- Optional custom alias
- Signed-in **dashboard** (`/dashboard`): list / edit / rename / disable / delete owned links
- **Admin** (`/admin`): force-disable any code; process metrics (redirect latency, 429s)
- Click count on redirect (atomic Postgres `UPDATE`)
- Flexible expiry: relative (`30m`, `7d`), absolute datetime, and/or max clicks
- Case-insensitive short codes; race-safe create + max-click redirects
- HTML 404/410 pages for dead links in browsers
- Clerk auth for ownership; webhook purges links on `user.deleted`

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind 4, Clerk |
| Backend | Node 20+, Express 5, TypeScript 6, Clerk |
| DB | PostgreSQL + Prisma 7 |

## Core design notes

- **Hybrid create:** `POST /api/v1/urls/shorten` works without auth (`clerk_user_id` null). Bearer token attaches owner.
- **Manage stays owned:** list / get / patch / delete require Clerk and ownership (UI on `/dashboard`).
- **Thin redirect path:** `GET /:code` skips Clerk, body parsers, compression, and the global API rate limit. Dedicated redirect limiter only. No Redis — Postgres-only hot path.
- **Monitoring:** `/health` includes redirect counters + latency percentiles + 429 count (in-process). Full snapshot also on `GET /api/v1/admin/metrics`.
- **Admin:** set `ADMIN_CLERK_USER_IDS` (comma-separated Clerk user ids) for takedown + metrics UI.

## Run locally

### Prerequisites

- Node 20.19+ (24 recommended)
- PostgreSQL (Docker example below)
- Clerk app keys (frontend + backend)

### PostgreSQL (Docker)

If the API health check shows `database: unhealthy`, Postgres is down.

```bash
# existing local container (common on this machine)
docker start pg-learn

# or first-time:
docker run -d --name pg-learn --restart unless-stopped \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=url_shortener \
  -p 5432:5432 \
  -v pg-learn-data:/var/lib/postgresql/data \
  postgres:16
```

Match `DATABASE_URL` in `backend/.env` to that user/password/db, then:

```bash
cd backend && npm run db:migrate
```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # edit DATABASE_URL, BASE_URL, CORS_ORIGIN, Clerk keys
npm run db:generate
npm run db:migrate     # or: npm run db:push
npm run dev            # http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
# .env.local: NEXT_PUBLIC_API_URL + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (+ secret if needed)
npm run dev            # http://localhost:3001
```

Open **http://localhost:3001**

## Ops checklist (admin + webhook)

### Admin access

1. Sign in once at http://localhost:3001
2. Copy your Clerk user id from [Clerk Dashboard → Users](https://dashboard.clerk.com) (`user_...`)
3. In `backend/.env`:
   ```bash
   ADMIN_CLERK_USER_IDS=user_YOUR_ID
   ```
4. Restart backend → header shows **Admin**; `/admin` metrics + takedown work

### Clerk `user.deleted` webhook

Code path: `POST /api/v1/webhooks/clerk` (Svix verify → purge owned URLs).

1. Clerk Dashboard → **Webhooks** → Add endpoint  
   - URL: `https://<your-public-api-host>/api/v1/webhooks/clerk`  
   - Local: use [Clerk tunnel / ngrok](https://clerk.com/docs/webhooks/sync-data) to expose `:3000`
2. Subscribe to **`user.deleted`**
3. Copy signing secret → `backend/.env`:
   ```bash
   CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
   ```
4. Restart backend. Without this secret, webhook returns **503**.

## API (v1)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/v1/urls/shorten` | Optional | Create short link (`expiresAt` / `expiresIn` / `maxClicks`) |
| GET | `/api/v1/urls/` | Required | List owned links |
| GET | `/api/v1/urls/:code` | Required | Get owned link |
| PATCH | `/api/v1/urls/:code` | Required | Edit owned link |
| DELETE | `/api/v1/urls/:code` | Required | Delete owned link |
| GET | `/api/v1/admin/me` | Required | `{ isAdmin }` for UI nav |
| GET | `/api/v1/admin/metrics` | Admin | Process metrics snapshot |
| GET | `/api/v1/admin/urls/:code` | Admin | Lookup any link (incl. owner) |
| POST | `/api/v1/admin/urls/:code/disable` | Admin | Force-disable (takedown) |
| POST | `/api/v1/webhooks/clerk` | Svix | Clerk lifecycle (e.g. purge on delete) |
| GET | `/:code` | Public | Redirect (302); 404/410 HTML or JSON if dead |
| GET | `/health` | Public | Health + redirect metrics |

Expiry inputs (create/update):

- `expiresIn` — `"30m"`, `"12h"`, `"7d"`, `"1w"`, or seconds number
- `expiresAt` — ISO datetime (or `null` to clear). Not with `expiresIn`
- `maxClicks` — positive int, or `null` to clear

## Project layout

```text
url-shortener/
├── README.md
├── backend/
│   ├── prisma/           # schema, migrations
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   └── index.ts
│   └── Dockerfile
└── frontend/
    └── src/
        ├── app/          # home + Clerk sign-in/up
        ├── lib/          # API helper
        └── types/
```
