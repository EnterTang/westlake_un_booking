import { expect, test } from "vitest";
import { TestBookingDatabase } from "./test-booking-db";

const eventId = "event-1";

function adminRequest(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function seededAdminDb() {
  const database = new TestBookingDatabase([
    {
      id: "slot-1",
      eventId,
      maxCapacity: 1,
      startTime: "09:00",
      endTime: "09:45",
      type: "ONE_ON_ONE",
      displayOrder: 0,
    },
    {
      id: "slot-group",
      eventId,
      maxCapacity: 12,
      startTime: "11:30",
      endTime: "13:15",
      type: "GROUP",
      displayOrder: 1,
      reservedCount: 0,
    },
  ]);
  database.publishEvent({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: "https://example.com/ada",
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: "Conversations",
    isPublished: true,
  });
  await database.seedBooking({
    slotId: "slot-1",
    userName: "Lin",
    passcodeHash: "scrypt$salt$secret-hash-value",
  });
  return database;
}

test("admin mutation rejects missing session", async () => {
  const { createAdminEventsHandlers } = await import("../lib/admin-api");
  const database = await seededAdminDb();
  const { POST } = createAdminEventsHandlers({
    database: database as never,
    requireAdmin: async () => {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    },
  });

  const response = await POST(adminRequest("POST", "/api/admin/events", { title: "New" }));
  expect(response.status).toBe(401);
});

test("CSV export never contains edit-code hashes", async () => {
  const { exportBookingsCsv } = await import("../lib/admin-api");
  const database = await seededAdminDb();
  const csv = await exportBookingsCsv(eventId, database as never);

  expect(csv).toContain("name,bookingType,timeSlot,createdAt");
  expect(csv).toContain("Lin");
  expect(csv).toContain("ONE_ON_ONE");
  expect(csv).toContain("09:00-09:45");
  expect(csv).not.toContain("editCodeHash");
  expect(csv).not.toContain("passcodeHash");
  expect(csv).not.toContain("secret-hash-value");
  expect(csv).not.toContain("scrypt$");
});

test("admin release cancels a booking and frees capacity", async () => {
  const { createAdminBookingHandlers } = await import("../lib/admin-api");
  const database = await seededAdminDb();
  expect(database.reservedCount("slot-1")).toBe(1);

  const { DELETE } = createAdminBookingHandlers({
    database: database as never,
    requireAdmin: async () => undefined,
  });

  const bookingId = database.listBookings()[0]!.id;
  const response = await DELETE(
    adminRequest("DELETE", `/api/admin/bookings/${bookingId}`),
    { params: Promise.resolve({ bookingId }) },
  );

  expect(response.status).toBe(204);
  expect(database.reservedCount("slot-1")).toBe(0);
  expect(database.listBookings()).toHaveLength(0);
});

test("admin can lock a slot", async () => {
  const { createAdminSlotsHandlers } = await import("../lib/admin-api");
  const database = await seededAdminDb();
  const { PATCH } = createAdminSlotsHandlers({
    database: database as never,
    requireAdmin: async () => undefined,
  });

  const response = await PATCH(
    adminRequest("PATCH", "/api/admin/slots", {
      slotId: "slot-1",
      isLocked: true,
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id: "slot-1", isLocked: true });
});
