# Appointment System

Vercel-ready appointment booking app built with Next.js App Router, Prisma, and PostgreSQL.

**完整部署步骤（中文）请看：[DEPLOYMENT.md](./DEPLOYMENT.md)**

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Prisma + serverless PostgreSQL (Neon recommended; Supabase also works)
- Optional Upstash Redis for rate limiting only
- Optional Vercel Blob for speaker avatar uploads

## Local setup

```bash
cp .env.example .env
# Fill DATABASE_URL, DIRECT_URL, ADMIN_PASSWORD, SESSION_SECRET, BOOKING_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open:

- Public booking: [http://localhost:3000/events/dr-xiao-jie-2026-08-04](http://localhost:3000/events/dr-xiao-jie-2026-08-04)
- Admin login: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed the Dr. Xiao Jie event and slots |
| `npm test` | Run Vitest suite |

On Vercel, `vercel.json` runs `prisma generate`, `prisma migrate deploy`, then `next build` so schema migrations apply during deploy.

## Quick production checklist

1. Neon: set `DATABASE_URL` (pooled) + `DIRECT_URL` (direct)
2. Vercel env: `ADMIN_PASSWORD`, `SESSION_SECRET`, `BOOKING_SECRET`
3. Optional: `BLOB_READ_WRITE_TOKEN`, Upstash Redis
4. Deploy from GitHub
5. Seed once via Neon SQL Editor (`prisma/seed.sql`) or `npm run db:seed`
6. Open `/events/dr-xiao-jie-2026-08-04` and `/admin/login`

Details: [DEPLOYMENT.md](./DEPLOYMENT.md)

## Security notes

- Visitor edit codes are stored as salted `scrypt` hashes (`passcodeHash`) and are never returned by APIs or CSV export.
- Slot capacity is enforced with conditional `reservedCount` updates inside PostgreSQL transactions. Redis is optional and never replaces that invariant.
