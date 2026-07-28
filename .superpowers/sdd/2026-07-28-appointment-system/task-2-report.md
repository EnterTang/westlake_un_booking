# Task 2 Report: Capacity-Safe Booking Transactions

## Files Changed

- `lib/db.ts`: adds the shared Prisma client for the server runtime.
- `lib/validation.ts`: validates public booking inputs, exposes typed public-safe errors, and hashes/verifies four-digit edit codes with salted `scrypt` and `timingSafeEqual`.
- `lib/booking.ts`: implements create, update, and cancel booking transactions. `reservedCount` is only changed with conditional PostgreSQL updates in the transaction.
- `tests/booking.test.ts`: covers validation, non-sensitive results, incorrect edit codes, cancellation capacity release, group capacity, and a slot move.
- `tests/concurrency.test.ts`: covers parallel capacity-one and shared-capacity claims.
- `tests/test-booking-db.ts`: supplies a transaction-shaped in-memory test adapter so the service behavior can be exercised without a local PostgreSQL server.

## RED Evidence

Command:

```sh
npm test -- tests/booking.test.ts tests/concurrency.test.ts
```

Result before production code: 6 tests failed because `../lib/booking` did not exist. The failure was the intended missing-service failure.

## GREEN Evidence

Command:

```sh
npm test -- tests/booking.test.ts tests/concurrency.test.ts
```

Result after implementation: 8 tests passed. Twelve simultaneous requests for a capacity-one slot produced exactly one successful booking; shared slots stopped at their configured capacity.

## Verification

```sh
npm test
DATABASE_URL='postgresql://user:pass@localhost:5432/appointments' DIRECT_URL='postgresql://user:pass@localhost:5432/appointments' npx prisma validate
npx tsc --noEmit
git diff --check
```

Result: 9 tests passed across 3 files; Prisma schema validation, TypeScript checking, and whitespace checks passed.

## Concerns

- No local PostgreSQL connection is configured, so the concurrency tests use a transaction-shaped test adapter. Production capacity correctness remains in the PostgreSQL conditional `updateMany` within the Prisma transaction; it does not depend on Redis.
- Prisma emits an existing deprecation warning for the `package.json#prisma` seed configuration, which should be migrated to `prisma.config.ts` before Prisma 7.
- `node_modules/` was already untracked and was not included in this task commit.

## Commit

`feat: add transactional booking service`
