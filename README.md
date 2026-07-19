# Shortlink — URL Shortener

Simple full-stack URL shortener: Next.js UI + Express API + PostgreSQL.

## Features

- Paste a long URL → get a short link
- Optional custom alias
- Edit destination (same short link)
- Disable / enable / delete
- Click count on redirect
- Redirect via PostgreSQL

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind 4 |
| Backend | Node 20+, Express 5, TypeScript 6 |
| DB | PostgreSQL + Prisma 7 |

## Run locally

### Prerequisites

- Node 20.19+ (24 recommended)
- PostgreSQL (Docker example below)

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
cp .env.example .env   # edit DATABASE_URL, BASE_URL, CORS_ORIGIN
npm run db:generate
npm run db:migrate     # or: npm run db:push
npm run dev            # http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:3000' > .env.local
npm run dev            # http://localhost:3001
```

Open **http://localhost:3001**

## API (v1)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/urls/shorten` | Create short link |
| GET | `/api/v1/urls/:code` | Get link (incl. clicks / active) |
| PATCH | `/api/v1/urls/:code` | Edit destination and/or `isActive` |
| DELETE | `/api/v1/urls/:code` | Delete link |
| GET | `/:code` | Redirect (302); increments clicks |
| GET | `/health` | Health |

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
        ├── app/          # home page UI
        ├── lib/          # API helper
        └── types/
```
