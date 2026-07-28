# Appointment System Design

## Goal

Build a Vercel-deployable appointment system with a public booking page and a password-protected administrator console. The initial seeded event is Dr. Xiao Jie’s 1:1 booking schedule, but the console can create and manage future events.

## Technology

- Next.js App Router with TypeScript and Tailwind CSS.
- Prisma with serverless PostgreSQL (Neon is the recommended Vercel integration; Supabase is supported by the same `DATABASE_URL` contract).
- Upstash Redis for short-lived duplicate-submission protection and rate limiting. Booking correctness does not depend on Redis.
- Password-only administrator session secured by `ADMIN_PASSWORD` and an HTTP-only signed cookie.

## Data Model

`Event` stores title, speaker, profile link, date, venue, description, and publishing status.

`Slot` belongs to an event and stores its display order, start and end times, capacity, and type (`ONE_ON_ONE` or `GROUP`). A locked slot is not bookable.

`Booking` belongs to one slot and stores name, a hash of the four-digit edit code, created and updated times, and cancellation state. The edit code is never returned to the browser or exported.

The schema adds a `reservedCount` integer to `Slot`. This makes capacity enforcement one atomic conditional update rather than a count-then-insert race.

## Public Booking Flow

1. The page reads an event and its slots, plus non-sensitive booking display data.
2. A visitor selects an open slot or group event and supplies a name and four-digit edit code.
3. The API validates input, applies a short Redis rate limit if configured, and starts a PostgreSQL transaction.
4. Within the transaction, the API atomically increments `Slot.reservedCount` only where `reservedCount < maxCapacity` and the slot is unlocked.
5. If the conditional update affected zero rows, the request returns HTTP 409 with the message that the slot was booked first.
6. On success, the API writes the booking with a salted edit-code hash and commits. A failed insert rolls back the increment.
7. Updating or cancelling a booking verifies the edit-code hash in the transaction. Cancellation decrements `reservedCount` exactly once.

This database invariant protects 1:1 slots under concurrent requests even if Redis is unavailable or a Serverless instance is duplicated.

## Administrator Console

`/admin/login` presents a password form. `/admin` requires the signed administrator cookie.

The console provides:

- Event details, publish state, and public link.
- Add, edit, reorder, lock, or delete slots.
- Capacity and type configuration for 1:1 and group activities.
- Booking list, search, CSV export, and a safe release action that cancels an individual booking.
- A dashboard summarizing open capacity and booked names.

All administrator mutations use authenticated route handlers and server-side validation.

## User Interface

The public page retains the calm editorial booking style of the existing Dr. Xiao Jie template: speaker information in the header, clear slot cards, a group-event area, and an adjacent booking panel. It is English-first and responsive.

The admin console uses compact tables and a focused event editor rather than exposing raw database concepts.

## Environment Contract

```dotenv
DATABASE_URL=
DIRECT_URL=
ADMIN_PASSWORD=
SESSION_SECRET=
BOOKING_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

`DATABASE_URL` uses the pooled serverless connection. `DIRECT_URL` is used by Prisma migrations. Redis variables are optional in local development but recommended in production.

## Testing

- Unit tests for input validation, slot capacity rules, and edit-code hashing.
- Integration test with parallel booking requests proving that one capacity-one slot produces one success and conflicts for the remaining requests.
- Route tests for cancellation, administrator authentication, and CSV escaping.
- Production build check before deployment.

## Deployment

Vercel hosts the Next.js project. Neon PostgreSQL and Upstash Redis can both be added through the Vercel Marketplace. The README will include exact environment-variable setup, Prisma migration commands, seed instructions, and a one-click Vercel deployment checklist.
