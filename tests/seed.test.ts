import { expect, test } from "vitest";

test("Dr. Xiao Jie seed has six 1:1 slots and one student lunch meeting", async () => {
  const { buildSeedEvent, SEEDED_EVENT_ID } = await import("../prisma/seed-data");
  const event = buildSeedEvent();

  expect(SEEDED_EVENT_ID).toBe("dr-xiao-jie-2026-08-04");
  expect(event.id).toBe(SEEDED_EVENT_ID);
  expect(event.isPublished).toBe(true);
  expect(event.slots.filter((slot) => slot.type === "ONE_ON_ONE")).toHaveLength(6);
  expect(event.slots.find((slot) => slot.type === "GROUP")?.startTime).toBe("11:30");
  expect(event.slots.find((slot) => slot.type === "GROUP")?.endTime).toBe("13:15");
  expect(event.slots.find((slot) => slot.type === "GROUP")?.maxCapacity).toBe(12);
});
