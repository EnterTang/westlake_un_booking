import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { PublicEvent } from "../lib/event-api";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function sampleEvent(overrides?: Partial<PublicEvent>): PublicEvent {
  return {
    id: "event-1",
    title: "1V1 Booking with Dr. Xiao Jie",
    speaker: "Dr. Xiao Jie",
    profileLink: "https://example.com/speakers/xiao-jie",
    avatarUrl: null as string | null,
    date: new Date("2026-08-04T00:00:00.000Z"),
    venue: "Yungu Campus / TBD",
    description: "One-on-one conversations and a Student Lunch Meeting.",
    isPublished: true,
    slots: [
      {
        id: "slot-booked",
        displayOrder: 0,
        startTime: "09:00",
        endTime: "09:45",
        maxCapacity: 1,
        reservedCount: 1,
        type: "ONE_ON_ONE",
        isLocked: false,
        bookings: [{ userName: "Lin" }],
      },
      {
        id: "slot-open",
        displayOrder: 1,
        startTime: "09:55",
        endTime: "10:40",
        maxCapacity: 1,
        reservedCount: 0,
        type: "ONE_ON_ONE",
        isLocked: false,
        bookings: [],
      },
      {
        id: "slot-locked",
        displayOrder: 2,
        startTime: "10:50",
        endTime: "11:20",
        maxCapacity: 1,
        reservedCount: 0,
        type: "ONE_ON_ONE",
        isLocked: true,
        bookings: [],
      },
      {
        id: "slot-group",
        displayOrder: 3,
        startTime: "11:30",
        endTime: "13:15",
        maxCapacity: 12,
        reservedCount: 3,
        type: "GROUP",
        isLocked: false,
        bookings: [{ userName: "A" }, { userName: "B" }, { userName: "C" }],
      },
    ],
    ...overrides,
  };
}

test("shows booked and open slot states", async () => {
  const { PublicBooking } = await import("../components/public-booking");
  render(<PublicBooking event={sampleEvent()} />);

  expect(screen.getByRole("button", { name: "09:00-09:45 Booked" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "09:55-10:40 Open" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "10:50-11:20 Locked" })).toBeDisabled();
});

test("shows group capacity as attendee count", async () => {
  const { PublicBooking } = await import("../components/public-booking");
  render(<PublicBooking event={sampleEvent()} />);

  expect(screen.getByText(/3\/12 attendees/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: /11:30-13:15/i })).toBeEnabled();
});

test("keeps typed name and edit code after a booking conflict", async () => {
  const user = userEvent.setup();
  const { PublicBooking } = await import("../components/public-booking");

  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ code: "SLOT_UNAVAILABLE", message: "This time slot is no longer available." }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    ),
  );

  render(<PublicBooking event={sampleEvent()} />);
  await user.click(screen.getByRole("button", { name: "09:55-10:40 Open" }));
  await user.type(screen.getByLabelText(/your name/i), "Ada");
  await user.type(screen.getByLabelText(/4-digit edit code/i), "1234");
  await user.click(screen.getByRole("button", { name: /confirm booking/i }));

  expect(await screen.findByText(/no longer available/i)).toBeTruthy();
  expect((screen.getByLabelText(/your name/i) as HTMLInputElement).value).toBe("Ada");
  expect((screen.getByLabelText(/4-digit edit code/i) as HTMLInputElement).value).toBe("1234");
});

test("clear local device data removes only local booking ids", async () => {
  const user = userEvent.setup();
  localStorage.setItem("appointment:recent-bookings:event-1", JSON.stringify(["booking-1"]));
  const { PublicBooking } = await import("../components/public-booking");

  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  render(<PublicBooking event={sampleEvent()} />);
  expect(screen.getByText(/1 saved on this device/i)).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /reset local bookings/i }));
  expect(localStorage.getItem("appointment:recent-bookings:event-1")).toBeNull();
  expect(screen.queryByText(/1 saved on this device/i)).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
