import { expect, test, vi } from "vitest";
import { TestBookingDatabase } from "./test-booking-db";

test("admin can upload an event avatar image", async () => {
  vi.stubEnv("SESSION_SECRET", "test-session-secret-at-least-32-chars");
  const database = new TestBookingDatabase([]);
  database.publishEvent({
    id: "event-1",
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: null,
    avatarUrl: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: true,
  });

  const { createAdminAvatarHandlers } = await import("../lib/admin-avatar-api");
  const { POST } = createAdminAvatarHandlers({
    database: database as never,
    requireAdmin: async () => undefined,
    storeAvatar: async () => ({ url: "https://blob.example/avatar.png" }),
  });

  const form = new FormData();
  form.append(
    "avatar",
    new File([Uint8Array.from([137, 80, 78, 71])], "avatar.png", { type: "image/png" }),
  );

  const response = await POST(
    new Request("http://localhost/api/admin/events/event-1/avatar", {
      method: "POST",
      body: form,
    }),
    { params: Promise.resolve({ eventId: "event-1" }) },
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    id: "event-1",
    avatarUrl: "https://blob.example/avatar.png",
  });
  expect(database.getEvent("event-1")?.avatarUrl).toBe("https://blob.example/avatar.png");
});

test("admin avatar upload rejects missing session", async () => {
  const { createAdminAvatarHandlers } = await import("../lib/admin-avatar-api");
  const { POST } = createAdminAvatarHandlers({
    requireAdmin: async () => {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    },
  });

  const response = await POST(
    new Request("http://localhost/api/admin/events/event-1/avatar", { method: "POST", body: new FormData() }),
    { params: Promise.resolve({ eventId: "event-1" }) },
  );
  expect(response.status).toBe(401);
});

test("admin avatar upload rejects non-image files", async () => {
  const database = new TestBookingDatabase([]);
  database.publishEvent({
    id: "event-1",
    title: "Office Hours",
    speaker: "Dr. Ada",
    profileLink: null,
    avatarUrl: null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu",
    description: null,
    isPublished: true,
  });

  const { createAdminAvatarHandlers } = await import("../lib/admin-avatar-api");
  const { POST } = createAdminAvatarHandlers({
    database: database as never,
    requireAdmin: async () => undefined,
  });

  const form = new FormData();
  form.append("avatar", new File(["hello"], "notes.txt", { type: "text/plain" }));

  const response = await POST(
    new Request("http://localhost/api/admin/events/event-1/avatar", { method: "POST", body: form }),
    { params: Promise.resolve({ eventId: "event-1" }) },
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "INVALID_INPUT" });
});
