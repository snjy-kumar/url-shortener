# Shortlink — URL Shortener

Simple full-stack URL shortener: Next.js UI + Express API + PostgreSQL (+ optional Redis).

## Features

- Paste a long URL → get a short link
- Optional custom alias
- Redirect with optional Redis cache

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind 4 |
| Backend | Node 20+, Express 5, TypeScript 6 |
| DB | PostgreSQL + Prisma 7 |
| Cache | Redis (optional) |

## Run locally

### Prerequisites

- Node 20.19+ (24 recommended)
- PostgreSQL
- Redis (optional)

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
| GET | `/:code` | Redirect (302) |
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
