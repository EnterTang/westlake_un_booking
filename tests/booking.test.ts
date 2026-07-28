import { expect, test } from "vitest";
import { TestBookingDatabase } from "./test-booking-db";

async function bookingService() {
  return import("../lib/booking");
}

test("rejects a non-four-digit edit code", async () => {
  const { createBooking } = await bookingService();
  const database = new TestBookingDatabase([{ id: "slot-1", maxCapacity: 1 }]);

  await expect(
    createBooking({ slotId: "slot-1", userName: "Ada", editCode: "12" }, database),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("stores a salted edit-code hash and never returns it", async () => {
  const { createBooking } = await bookingService();
  const database = new TestBookingDatabase([{ id: "slot-1", maxCapacity: 1 }]);

  const booking = await createBooking(
    { slotId: "slot-1", userName: "Ada", editCode: "1234" },
    database,
  );

  expect(booking).toMatchObject({ slotId: "slot-1", userName: "Ada" });
  expect(booking).not.toHaveProperty("passcodeHash");
  expect(JSON.stringify(booking)).not.toContain("1234");
});

test("rejects cancellation with an incorrect edit code", async () => {
  const { cancelBooking, createBooking } = await bookingService();
  const database = new TestBookingDatabase([{ id: "slot-1", maxCapacity: 1 }]);
  const booking = await createBooking(
    { slotId: "slot-1", userName: "Ada", editCode: "1234" },
    database,
  );

  await expect(
    cancelBooking({ bookingId: booking.bookingId, editCode: "4321" }, database),
  ).rejects.toMatchObject({ code: "INVALID_EDIT_CODE" });
  expect(database.reservedCount("slot-1")).toBe(1);
});

test("cancellation releases exactly one reserved place", async () => {
  const { cancelBooking, createBooking } = await bookingService();
  const database = new TestBookingDatabase([{ id: "slot-1", maxCapacity: 1 }]);
  const booking = await createBooking(
    { slotId: "slot-1", userName: "Ada", editCode: "1234" },
    database,
  );

  await cancelBooking({ bookingId: booking.bookingId, editCode: "1234" }, database);
  expect(database.reservedCount("slot-1")).toBe(0);

  await expect(
    cancelBooking({ bookingId: booking.bookingId, editCode: "1234" }, database),
  ).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND" });
});

test("a group slot accepts bookings only up to its capacity", async () => {
  const { createBooking } = await bookingService();
  const database = new TestBookingDatabase([{ id: "lunch", maxCapacity: 2 }]);

  await createBooking({ slotId: "lunch", userName: "Ada", editCode: "1234" }, database);
  await createBooking({ slotId: "lunch", userName: "Lin", editCode: "5678" }, database);

  await expect(
    createBooking({ slotId: "lunch", userName: "Mo", editCode: "9012" }, database),
  ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  expect(database.reservedCount("lunch")).toBe(2);
});

test("moves a booking only after claiming capacity in the destination slot", async () => {
  const { createBooking, updateBooking } = await bookingService();
  const database = new TestBookingDatabase([
    { id: "morning", maxCapacity: 1 },
    { id: "afternoon", maxCapacity: 1 },
  ]);
  const booking = await createBooking(
    { slotId: "morning", userName: "Ada", editCode: "1234" },
    database,
  );

  const updated = await updateBooking(
    {
      bookingId: booking.bookingId,
      slotId: "afternoon",
      userName: "Ada Lovelace",
      editCode: "1234",
    },
    database,
  );

  expect(updated).toMatchObject({ slotId: "afternoon", userName: "Ada Lovelace" });
  expect(database.reservedCount("morning")).toBe(0);
  expect(database.reservedCount("afternoon")).toBe(1);
});
