# URL Shortener — Full‑Stack App

A modern, full‑stack URL shortener with rich analytics, QR/AR, and AI‑assisted features. Built with Next.js (frontend) and Node.js + Express + Prisma (backend).

## What’s this app about?

Turn long links into short, branded URLs, share them as QR codes, and track performance with visual analytics. Power users get custom domains and slugs, link expiration, password protection, and AI suggestions for better slugs and posting times.

## Features

- URL creation and management
  - Custom slugs and optional custom domain
  - Descriptions, tags, and link status toggling
  - Expiration dates and password‑protected links
- QR codes and AR
  - Generate customizable QR codes (colors, logo)
  - Download PNG/SVG
  - Optional AR hooks for immersive content
- Analytics dashboard
  - Total/unique clicks, CTR, trends over time
  - Top referrers, countries, devices
  - CSV export
- AI optimization and recommendations
  - Smart slug suggestions
  - Best time to share recommendations
  - Personalized suggestions based on past links
- Secure and scalable backend
  - Prisma ORM with SQLite (dev) or Postgres (prod‑ready)
  - Robust validation, rate‑limit, logging
  - Clean service/controller architecture

## Tech stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI, Recharts, Chart.js, React Hook Form, Zod, Axios, React Hot Toast
- Backend: Node.js, Express, TypeScript, Prisma, SQLite (dev) / PostgreSQL (prod), Zod, Winston, Helmet, CORS, Rate‑limit

## Repository structure

```text
url-shortener/
├─ backend/
│  ├─ src/
│  ├─ prisma/
│  ├─ package.json
│  └─ README.md
├─ frontend/
│  ├─ src/
│  ├─ package.json
│  └─ README.md
└─ README.md  ← you are here
```

## Getting started

### Prerequisites

- Node.js 18+
- npm 9+

### Backend setup

1. Install dependencies

   ```bash
   cd backend
   npm install
   ```

1. Configure environment

   ```bash
   cp .env.example .env
   ```

   Key variables:

   - DATABASE_URL (sqlite or postgres)
   - PORT (default 3000)
   - CORS_ORIGIN (e.g. <http://localhost:3000> for frontend)

1. Initialize database (dev)

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed # optional
   ```

1. Start the dev server

   ```bash
   npm run dev
   ```

   API defaults to <http://localhost:3000>

### Frontend setup

1. Install dependencies

   ```bash
   cd ../frontend
   npm install
   ```

1. Start the dev server

   ```bash
   npm run dev
   ```

   Next.js will start on <http://localhost:3000> (or the next available port)

1. Production build

   ```bash
   npm run build && npm start
   ```

## Frontend details

- App Router with pages:
  - `/` Landing page with quick shortener and feature highlights
  - `/dashboard`
    - Create: Enhanced URL Shortener (custom slug, domain, expiry, password, AI suggestions)
    - Manage: list with search, sort, copy, delete
    - Analytics: trends, referrers, geo, devices; CSV export
    - QR/AR: generator with customization and downloads
    - Recommendations: personalized suggestions

- Key components
  - `EnhancedUrlShortener.tsx` — advanced link creator with AI helpers
  - `UrlManager.tsx` — table/grid of URLs with actions
  - `AnalyticsDashboard.tsx` — interactive charts (Recharts/Chart.js)
  - `QRCodeGenerator.tsx` — styled QR generation and export
  - `PersonalizedRecommendations.tsx` — suggestion feed

- Useful scripts
  - `npm run dev` — start Next dev (Turbopack)
  - `npm run build` — production build
  - `npm run start` — start production server
  - `npm run lint` — lint

- Config and utilities
  - `src/lib/api.ts` and `src/services/urlService.ts` for API calls
  - Zod schemas + React Hook Form for validation
  - Radix UI for accessible components

## Backend details

- Express API with modular routes/services
  - `POST /api/v1/urls/shorten` — create short URL
  - `GET /api/v1/urls` — list (pagination supported via query)
  - `GET /api/v1/urls/:shortCode` — details
  - `DELETE /api/v1/urls/:shortCode` — delete
  - `GET /:shortCode` — redirect
  - Auth routes exist as placeholders (`/api/v1/auth/*`)

- Prisma schema (SQLite dev, Postgres ready)
  - Models: `User`, `Url`, `Analytics`, `ApiKey`
  - Indices on frequently queried fields

- Scripts
  - `npm run dev` — tsx watch
  - `npm run build` — tsc
  - `npm start` — node dist/index.js
  - `npm run db:*` — prisma generate/migrate/seed/studio/reset

- Middleware
  - Validation (Zod/express-validator), request logging, error handler
  - Helmet, CORS, compression, rate‑limiting

## Environment variables

Backend `.env` (sample):

```env
DATABASE_URL="file:./dev.db"          # or postgres://user:pass@host:5432/db
PORT=3000
NODE_ENV=development
JWT_SECRET=replace_me
BASE_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

Frontend `.env.local` (optional):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

## Development tips

- If using Postgres, update `datasource db` in `backend/prisma/schema.prisma` and set `DATABASE_URL` accordingly, then re‑run migrations.
- During local dev, the frontend may run on 3001 if 3000 is taken; keep `CORS_ORIGIN` in backend in sync.
- Analytics and AI features gracefully fall back to mock data when the API isn’t available.

## Roadmap

- OAuth login, multi‑tenant teams, custom domains management
- Webhooks, bulk import/export, public API keys
- Advanced analytics (A/B, cohorts), anomaly detection

## License

MIT © 2025 Sanjay Kumar Thakur
