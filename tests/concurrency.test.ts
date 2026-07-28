import { expect, test } from "vitest";
import { TestBookingDatabase } from "./test-booking-db";

test("only one parallel request can book a capacity-one slot", async () => {
  const { createBooking } = await import("../lib/booking");
  const database = new TestBookingDatabase([{ id: "one-to-one", maxCapacity: 1 }]);

  const responses = await Promise.allSettled(
    Array.from({ length: 12 }, (_, index) =>
      createBooking(
        { slotId: "one-to-one", userName: `Guest ${index}`, editCode: "1234" },
        database,
      ),
    ),
  );

  expect(responses.filter((item) => item.status === "fulfilled")).toHaveLength(1);
  expect(database.reservedCount("one-to-one")).toBe(1);
  expect(
    responses.filter((item) => item.status === "rejected").every(
      (item) => item.status === "rejected" && (item.reason as { code?: string }).code === "SLOT_UNAVAILABLE",
    ),
  ).toBe(true);
});

test("parallel group bookings stop exactly at the shared capacity", async () => {
  const { createBooking } = await import("../lib/booking");
  const database = new TestBookingDatabase([{ id: "lunch", maxCapacity: 3 }]);

  const responses = await Promise.allSettled(
    Array.from({ length: 9 }, (_, index) =>
      createBooking(
        { slotId: "lunch", userName: `Student ${index}`, editCode: `${1000 + index}` },
        database,
      ),
    ),
  );

  expect(responses.filter((item) => item.status === "fulfilled")).toHaveLength(3);
  expect(database.reservedCount("lunch")).toBe(3);
});
