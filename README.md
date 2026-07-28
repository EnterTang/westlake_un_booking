# Appointment System

Vercel-ready appointment booking app built with Next.js App Router, Prisma, and PostgreSQL.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Prisma + serverless PostgreSQL (Neon recommended; Supabase also works)
- Optional Upstash Redis for rate limiting only

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

## Vercel deployment checklist

1. Create a Neon PostgreSQL project (or another serverless Postgres provider).
2. Copy the **pooled** connection string into Vercel env `DATABASE_URL` (include `pgbouncer=true` when using Neon pooled).
3. Copy the **direct** connection string into Vercel env `DIRECT_URL`.
4. (Recommended) Add Upstash Redis from the Vercel Marketplace and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
5. Set secrets in the Vercel project:
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - `BOOKING_SECRET`
6. Deploy the Git repository to Vercel. `vercel.json` runs `prisma generate`, `prisma migrate deploy`, then `next build`.
7. After the first successful deploy, run seed once (local or Vercel CLI):

```bash
npm run db:seed
```

8. Visit `/events/dr-xiao-jie-2026-08-04` for the public page and `/admin/login` for the console.

## Security notes

- Visitor edit codes are stored as salted `scrypt` hashes (`passcodeHash`) and are never returned by APIs or CSV export.
- Slot capacity is enforced with conditional `reservedCount` updates inside PostgreSQL transactions. Redis is optional and never replaces that invariant.
