import { expect, test } from "vitest";
import { TestBookingDatabase } from "./test-booking-db";

const eventId = "event-1";
const slotId = "slot-1";

function jsonRequest(method: string, body: unknown, path = `/api/events/${eventId}/bookings`) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function loadHandlers(database: TestBookingDatabase) {
  const { createEventRouteHandlers } = await import("../lib/event-api");
  const { createBookingRouteHandlers } = await import("../lib/bookings-api");
  const rateLimit = async () => ({ allowed: true as const });

  return {
    GET: createEventRouteHandlers({ database: database as never }).GET,
    ...createBookingRouteHandlers({ database: database as never, rateLimit }),
  };
}

test("GET returns published event metadata with safe booking display", async () => {
  const database = new TestBookingDatabase([{ id: slotId, maxCapacity: 1, eventId }]);
  database.publishEvent({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: "https://example.com/ada",
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: "1:1 conversations",
    isPublished: true,
  });
  await database.seedBooking({
    slotId,
    userName: "Lin",
    passcodeHash: "scrypt$salt$key",
  });

  const { GET } = await loadHandlers(database);
  const response = await GET(new Request(`http://localhost/api/events/${eventId}`), {
    params: Promise.resolve({ eventId }),
  });

  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload).toMatchObject({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: "https://example.com/ada",
    venue: "Yungu",
    isPublished: true,
  });
  expect(payload.slots[0]).toMatchObject({
    id: slotId,
    maxCapacity: 1,
    reservedCount: 1,
    bookings: [{ userName: "Lin" }],
  });
  expect(JSON.stringify(payload)).not.toContain("passcodeHash");
  expect(JSON.stringify(payload)).not.toContain("scrypt$");
});

test("GET hides unpublished events", async () => {
  const database = new TestBookingDatabase([{ id: slotId, maxCapacity: 1, eventId }]);
  database.publishEvent({
    id: eventId,
    title: "Draft",
    speaker: "Dr. Ada",
    profileLink: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: false,
  });

  const { GET } = await loadHandlers(database);
  const response = await GET(new Request(`http://localhost/api/events/${eventId}`), {
    params: Promise.resolve({ eventId }),
  });
  expect(response.status).toBe(404);
});

test("POST creates a booking and returns 201", async () => {
  const database = new TestBookingDatabase([{ id: slotId, maxCapacity: 1, eventId }]);
  database.publishEvent({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: true,
  });

  const { POST } = await loadHandlers(database);
  const response = await POST(
    jsonRequest("POST", { slotId, userName: "Ada", editCode: "1234" }),
    { params: Promise.resolve({ eventId }) },
  );

  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    slotId,
    userName: "Ada",
  });
  expect(database.reservedCount(slotId)).toBe(1);
});

test("returns 409 for an already claimed 1:1 slot", async () => {
  const database = new TestBookingDatabase([{ id: slotId, maxCapacity: 1, eventId }]);
  database.publishEvent({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: true,
  });

  const { POST } = await loadHandlers(database);
  const firstClaim = { slotId, userName: "Ada", editCode: "1234" };
  expect((await POST(jsonRequest("POST", firstClaim), { params: Promise.resolve({ eventId }) })).status).toBe(201);

  const response = await POST(
    jsonRequest("POST", { slotId, userName: "Lin", editCode: "5678" }),
    { params: Promise.resolve({ eventId }) },
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "SLOT_UNAVAILABLE" });
});

test("rejects invalid input with 400", async () => {
  const database = new TestBookingDatabase([{ id: slotId, maxCapacity: 1, eventId }]);
  database.publishEvent({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: true,
  });

  const { POST } = await loadHandlers(database);
  const response = await POST(
    jsonRequest("POST", { slotId, userName: "Ada", editCode: "12" }),
    { params: Promise.resolve({ eventId }) },
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "INVALID_INPUT" });
});

test("PATCH updates a booking after verifying the edit code", async () => {
  const database = new TestBookingDatabase([
    { id: "morning", maxCapacity: 1, eventId },
    { id: "afternoon", maxCapacity: 1, eventId },
  ]);
  database.publishEvent({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: true,
  });

  const { POST, PATCH } = await loadHandlers(database);
  const created = await POST(
    jsonRequest("POST", { slotId: "morning", userName: "Ada", editCode: "1234" }),
    { params: Promise.resolve({ eventId }) },
  );
  const booking = await created.json();

  const response = await PATCH(
    jsonRequest("PATCH", {
      bookingId: booking.bookingId,
      editCode: "1234",
      slotId: "afternoon",
      userName: "Ada Lovelace",
    }),
    { params: Promise.resolve({ eventId }) },
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    slotId: "afternoon",
    userName: "Ada Lovelace",
  });
  expect(database.reservedCount("morning")).toBe(0);
  expect(database.reservedCount("afternoon")).toBe(1);
});

test("DELETE cancels a booking and releases capacity", async () => {
  const database = new TestBookingDatabase([{ id: slotId, maxCapacity: 1, eventId }]);
  database.publishEvent({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: true,
  });

  const { POST, DELETE } = await loadHandlers(database);
  const created = await POST(
    jsonRequest("POST", { slotId, userName: "Ada", editCode: "1234" }),
    { params: Promise.resolve({ eventId }) },
  );
  const booking = await created.json();

  const response = await DELETE(
    jsonRequest("DELETE", { bookingId: booking.bookingId, editCode: "1234" }),
    { params: Promise.resolve({ eventId }) },
  );
  expect(response.status).toBe(204);
  expect(database.reservedCount(slotId)).toBe(0);
});

test("returns 429 when the rate limiter rejects the request", async () => {
  const database = new TestBookingDatabase([{ id: slotId, maxCapacity: 1, eventId }]);
  database.publishEvent({
    id: eventId,
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: true,
  });

  const { createBookingRouteHandlers } = await import("../lib/bookings-api");
  const { POST } = createBookingRouteHandlers({
    database: database as never,
    rateLimit: async () => ({ allowed: false }),
  });

  const response = await POST(
    jsonRequest("POST", { slotId, userName: "Ada", editCode: "1234" }),
    { params: Promise.resolve({ eventId }) },
  );
  expect(response.status).toBe(429);
  expect(await response.json()).toMatchObject({ code: "RATE_LIMITED" });
  expect(database.reservedCount(slotId)).toBe(0);
});
