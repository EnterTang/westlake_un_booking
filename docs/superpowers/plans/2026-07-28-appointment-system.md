# Appointment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Vercel-ready appointment system with a public booking flow, capacity-safe PostgreSQL persistence, and a password-protected administration console.

**Architecture:** Next.js App Router serves public event pages, authenticated administrator pages, and JSON route handlers. Prisma owns PostgreSQL access; conditional slot updates inside interactive transactions enforce capacity. Upstash Redis is optional and only rate-limits duplicate client submissions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Prisma, PostgreSQL (Neon or Supabase), Upstash Redis, Vitest.

## Global Constraints

- Use English copy in the public website.
- Store only a salted edit-code hash; never return or export the raw edit code.
- `Slot.reservedCount` is the capacity invariant: all create and cancel operations update it within one PostgreSQL transaction.
- Redis must not be needed for capacity correctness.
- Administrator access uses `ADMIN_PASSWORD`, `SESSION_SECRET`, and an HTTP-only signed session cookie.
- The project deploys without persistent local files and reads all secrets from Vercel environment variables.

---

## File Structure

- `package.json`: Next, Prisma, Tailwind, Redis, test scripts, and dependencies.
- `.env.example`: documented deployment environment contract.
- `prisma/schema.prisma`: Event, Slot, Booking, admin-safe schema and capacity fields.
- `prisma/seed.ts`: Dr. Xiao Jie event and initial public slot schedule.
- `lib/db.ts`: singleton Prisma client.
- `lib/booking.ts`: validation, PIN hashing, transactional create/edit/cancel methods.
- `lib/auth.ts`: signed administrator cookie helpers.
- `lib/rate-limit.ts`: optional Upstash rate limiter.
- `app/api/events/[eventId]/bookings/route.ts`: public booking APIs.
- `app/api/admin/*`: authenticated management and CSV APIs.
- `app/(public)/events/[eventId]/page.tsx`: public server-rendered event page.
- `components/public-booking.tsx`: client-side selection, submit, edit and clear-local-test-state behavior.
- `app/admin/login/page.tsx`, `app/admin/page.tsx`: administrator auth and console.
- `components/admin-console.tsx`: event, slot, booking and export controls.
- `tests/booking.test.ts`: transaction and edit-code tests.
- `tests/concurrency.test.ts`: parallel capacity-one booking test.
- `README.md`: local setup, database migration, seed, Vercel deployment.

## Task 1: Scaffold The Project And Database Contract

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `.env.example`
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

**Interfaces:**
- Produces `prisma.event`, `prisma.slot`, and `prisma.booking` delegates consumed by all later tasks.
- Produces `SlotType.ONE_ON_ONE | SlotType.GROUP` and a `reservedCount` field used by booking transactions.

- [ ] **Step 1: Write a schema validation test**

```ts
import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

test("schema retains the atomic capacity fields", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  expect(schema).toContain("reservedCount Int @default(0)");
  expect(schema).toContain("enum SlotType");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/schema.test.ts`

Expected: failure because the schema file does not yet exist.

- [ ] **Step 3: Add the Prisma schema and environment contract**

```prisma
model Slot {
  id            String   @id @default(cuid())
  eventId       String
  event         Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  startTime     String
  endTime       String
  maxCapacity   Int      @default(1)
  reservedCount Int      @default(0)
  type          SlotType @default(ONE_ON_ONE)
  isLocked      Boolean  @default(false)
  bookings      Booking[]
}
```

Define pooled `DATABASE_URL`, direct `DIRECT_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `BOOKING_SECRET`, and optional Upstash variables in `.env.example`. Configure `prisma db seed` to seed the six Dr. Xiao Jie 1:1 slots and Student Lunch Meeting.

- [ ] **Step 4: Run schema generation and test**

Run: `npx prisma generate && npm test -- tests/schema.test.ts`

Expected: Prisma client generated and test passes.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs app .env.example prisma tests/schema.test.ts
git commit -m "feat: scaffold appointment application"
```

## Task 2: Implement Capacity-Safe Booking Transactions

**Files:**
- Create: `lib/db.ts`
- Create: `lib/booking.ts`
- Create: `lib/validation.ts`
- Create: `tests/booking.test.ts`
- Create: `tests/concurrency.test.ts`

**Interfaces:**
- Produces `createBooking(input: CreateBookingInput): Promise<BookingResult>`.
- Produces `updateBooking(input: UpdateBookingInput): Promise<BookingResult>` and `cancelBooking(input: CancelBookingInput): Promise<void>`.
- `BookingResult` contains `bookingId`, `slotId`, `userName`, and `createdAt`, never `editCodeHash`.

- [ ] **Step 1: Write failing validation and capacity tests**

```ts
test("rejects a non-four-digit edit code", async () => {
  await expect(createBooking({ slotId: "slot", userName: "Ada", editCode: "12" }))
    .rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("only one parallel request can book a capacity-one slot", async () => {
  const responses = await Promise.allSettled(
    Array.from({ length: 12 }, (_, index) => createBooking({
      slotId: seededOneToOneSlotId,
      userName: `Guest ${index}`,
      editCode: "1234",
    })),
  );
  expect(responses.filter((item) => item.status === "fulfilled")).toHaveLength(1);
  expect(await reservedCount(seededOneToOneSlotId)).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/booking.test.ts tests/concurrency.test.ts`

Expected: failures because booking functions are not implemented.

- [ ] **Step 3: Implement the atomic transaction**

```ts
const claimed = await tx.slot.updateMany({
  where: { id: input.slotId, isLocked: false, reservedCount: { lt: slot.maxCapacity } },
  data: { reservedCount: { increment: 1 } },
});
if (claimed.count !== 1) throw new BookingError("SLOT_UNAVAILABLE");

return tx.booking.create({
  data: { slotId: input.slotId, userName: input.userName, editCodeHash: hashEditCode(input.editCode) },
});
```

Read the slot in the same transaction before the conditional update. On edit or cancellation, select the booking by id, compare a timing-safe hash, and decrement `reservedCount` only as part of the booking delete transaction.

- [ ] **Step 4: Run booking and parallel tests**

Run: `npm test -- tests/booking.test.ts tests/concurrency.test.ts`

Expected: all booking cases pass; exactly one parallel claim succeeds.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts lib/booking.ts lib/validation.ts tests/booking.test.ts tests/concurrency.test.ts
git commit -m "feat: add transactional booking service"
```

## Task 3: Expose Public Booking APIs With Rate Protection

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `app/api/events/[eventId]/route.ts`
- Create: `app/api/events/[eventId]/bookings/route.ts`
- Create: `tests/bookings-route.test.ts`

**Interfaces:**
- `GET /api/events/:eventId` returns public event metadata, slots, and safe booking display details.
- `POST /api/events/:eventId/bookings` accepts `{ slotId, userName, editCode }` and returns `201` or `409`.
- `PATCH` and `DELETE` accept `bookingId` and `editCode` for verified changes.

- [ ] **Step 1: Write failing route tests**

```ts
test("returns 409 for an already claimed 1:1 slot", async () => {
  await createBooking(firstClaim);
  const response = await POST(requestFor(firstClaim));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "SLOT_UNAVAILABLE" });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run: `npm test -- tests/bookings-route.test.ts`

Expected: failure because route handlers do not exist.

- [ ] **Step 3: Implement route handlers and optional Upstash limiter**

```ts
const limit = await limitBookingRequest(request);
if (!limit.allowed) return Response.json({ code: "RATE_LIMITED" }, { status: 429 });

try {
  return Response.json(await createBooking(body), { status: 201 });
} catch (error) {
  return Response.json(toPublicBookingError(error), { status: bookingStatus(error) });
}
```

When Redis variables are absent, `limitBookingRequest` returns `{ allowed: true }`; it never replaces the database transaction.

- [ ] **Step 4: Run route tests**

Run: `npm test -- tests/bookings-route.test.ts`

Expected: POST, PATCH, DELETE, conflict, and invalid-input cases pass.

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts app/api/events tests/bookings-route.test.ts
git commit -m "feat: add public booking APIs"
```

## Task 4: Build The Public Booking Experience

**Files:**
- Create: `app/(public)/events/[eventId]/page.tsx`
- Create: `components/public-booking.tsx`
- Create: `components/speaker-header.tsx`
- Modify: `app/globals.css`
- Create: `tests/public-booking.test.tsx`

**Interfaces:**
- Consumes the public event JSON shape from Task 3.
- Sends create, edit, and cancellation requests to Task 3 APIs.
- Stores only a local list of recently selected booking ids; `clear local device data` removes this list and does not alter database records.

- [ ] **Step 1: Write failing public component tests**

```tsx
test("shows booked and open slot states", () => {
  render(<PublicBooking event={eventWithOneBookedSlot} />);
  expect(screen.getByRole("button", { name: "09:00-09:45 Booked" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "09:55-10:40 Open" })).toBeEnabled();
});
```

- [ ] **Step 2: Run component tests to verify they fail**

Run: `npm test -- tests/public-booking.test.tsx`

Expected: failure because public components are absent.

- [ ] **Step 3: Implement responsive public components**

Use server rendering for the event shell and a single client component for selection and mutations. Render the speaker profile link and portrait, each 1:1 status (`Open`, `Booked`, `Locked`), and group-event attendee count. Keep the booking form fixed beside slots on desktop and below them on mobile. Display server conflicts without clearing a visitor's typed name or code.

- [ ] **Step 4: Run component tests and production build**

Run: `npm test -- tests/public-booking.test.tsx && npm run build`

Expected: UI tests and Next.js production build pass.

- [ ] **Step 5: Commit**

```bash
git add app/'(public)' components app/globals.css tests/public-booking.test.tsx
git commit -m "feat: add public appointment page"
```

## Task 5: Implement Administrator Authentication And Console

**Files:**
- Create: `lib/auth.ts`
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/login/actions.ts`
- Create: `app/admin/page.tsx`
- Create: `components/admin-console.tsx`
- Create: `app/api/admin/events/route.ts`
- Create: `app/api/admin/slots/route.ts`
- Create: `app/api/admin/bookings/[bookingId]/route.ts`
- Create: `app/api/admin/events/[eventId]/export/route.ts`
- Create: `tests/admin-auth.test.ts`
- Create: `tests/admin-api.test.ts`

**Interfaces:**
- `requireAdmin()` throws or redirects for missing/invalid signed cookies.
- Admin APIs accept validated event, slot, and release payloads and return only after authorization.
- CSV exports `name`, `bookingType`, `timeSlot`, `createdAt`, and never includes `editCodeHash`.

- [ ] **Step 1: Write failing auth and CSV tests**

```ts
test("admin mutation rejects missing session", async () => {
  expect((await POST(unauthenticatedRequest())).status).toBe(401);
});

test("CSV export never contains edit-code hashes", async () => {
  const csv = await exportBookings(eventId);
  expect(csv).not.toContain("editCodeHash");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/admin-auth.test.ts tests/admin-api.test.ts`

Expected: failure because administrator authentication and APIs are absent.

- [ ] **Step 3: Implement signed auth, CRUD APIs, and console**

Use Web Crypto HMAC signing for the session payload and set the cookie with `httpOnly`, `sameSite: "lax"`, `secure` in production, and a seven-day expiry. Protect every `/api/admin/*` handler. Build admin controls for event metadata, create/edit/reorder/lock slots, booking list, release booking, and CSV export.

When a booking is released, invoke `cancelBooking` rather than deleting a row directly so `reservedCount` remains correct.

- [ ] **Step 4: Run auth/API tests and build**

Run: `npm test -- tests/admin-auth.test.ts tests/admin-api.test.ts && npm run build`

Expected: protected operations reject unauthenticated calls and build passes.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts app/admin components/admin-console.tsx app/api/admin tests/admin-auth.test.ts tests/admin-api.test.ts
git commit -m "feat: add administrator console"
```

## Task 6: Prepare Deployment, Seed Data, And Verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `prisma/seed.ts`
- Create: `vercel.json`
- Create: `tests/seed.test.ts`

**Interfaces:**
- `npm run db:migrate`, `npm run db:seed`, and `npm run build` are documented release commands.
- `GET /events/<seeded-id>` is the initial public booking URL after seeding.

- [ ] **Step 1: Write a failing seed assertion**

```ts
test("Dr. Xiao Jie seed has six 1:1 slots and one student lunch meeting", async () => {
  const event = await seedAndLoadEvent();
  expect(event.slots.filter((slot) => slot.type === "ONE_ON_ONE")).toHaveLength(6);
  expect(event.slots.find((slot) => slot.type === "GROUP")?.startTime).toBe("11:30");
});
```

- [ ] **Step 2: Run seed test to verify it fails when data is incomplete**

Run: `npm test -- tests/seed.test.ts`

Expected: failure until seed event and slots are complete.

- [ ] **Step 3: Complete README and Vercel configuration**

Document: create a Neon PostgreSQL project, connect its pooled and direct URLs; create Upstash Redis through the Vercel Marketplace; set all six environment variables; run `npx prisma migrate deploy`; run `npm run db:seed`; and deploy. Include a one-command local start path and the exact admin route `/admin/login`.

- [ ] **Step 4: Run full verification**

Run: `npm test && npx prisma validate && npm run build`

Expected: all tests, Prisma schema validation, and production build pass.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example prisma/seed.ts vercel.json tests/seed.test.ts
git commit -m "docs: prepare Vercel deployment"
```
