import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type BookingErrorCode =
  | "INVALID_INPUT"
  | "SLOT_UNAVAILABLE"
  | "BOOKING_NOT_FOUND"
  | "INVALID_EDIT_CODE"
  | "DUPLICATE_BOOKING"
  | "BOOKING_FAILED";

const publicMessages: Record<BookingErrorCode, string> = {
  INVALID_INPUT: "Please check the booking information and try again.",
  SLOT_UNAVAILABLE: "This time slot is no longer available.",
  BOOKING_NOT_FOUND: "This booking could not be found.",
  INVALID_EDIT_CODE: "The edit code is incorrect.",
  DUPLICATE_BOOKING: "This name already has a booking in this time slot.",
  BOOKING_FAILED: "The booking could not be completed. Please try again.",
};

export class BookingError extends Error {
  constructor(public readonly code: BookingErrorCode) {
    super(publicMessages[code]);
    this.name = "BookingError";
  }
}

export type CreateBookingValues = {
  slotId: string;
  userName: string;
  editCode: string;
};

export type UpdateBookingValues = {
  bookingId: string;
  editCode: string;
  slotId?: string;
  userName?: string;
};

export type CancelBookingValues = {
  bookingId: string;
  editCode: string;
};

export function validateCreateBooking(input: CreateBookingValues): CreateBookingValues {
  return {
    slotId: requiredText(input.slotId),
    userName: requiredText(input.userName),
    editCode: validateEditCode(input.editCode),
  };
}

export function validateUpdateBooking(input: UpdateBookingValues): UpdateBookingValues {
  const slotId = optionalText(input.slotId);
  const userName = optionalText(input.userName);
  if (slotId === undefined && userName === undefined) {
    throw new BookingError("INVALID_INPUT");
  }

  return {
    bookingId: requiredText(input.bookingId),
    editCode: validateEditCode(input.editCode),
    ...(slotId === undefined ? {} : { slotId }),
    ...(userName === undefined ? {} : { userName }),
  };
}

export function validateCancelBooking(input: CancelBookingValues): CancelBookingValues {
  return {
    bookingId: requiredText(input.bookingId),
    editCode: validateEditCode(input.editCode),
  };
}

export function hashEditCode(editCode: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(editCode, salt, 64);
  return `scrypt$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

export function verifyEditCode(editCode: string, storedHash: string): boolean {
  const [algorithm, encodedSalt, encodedKey] = storedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedKey) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64");
    const expected = Buffer.from(encodedKey, "base64");
    const actual = scryptSync(editCode, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function requiredText(value: unknown): string {
  const normalized = optionalText(value);
  if (!normalized) throw new BookingError("INVALID_INPUT");
  return normalized;
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new BookingError("INVALID_INPUT");
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) throw new BookingError("INVALID_INPUT");
  return normalized;
}

function validateEditCode(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}$/.test(value)) {
    throw new BookingError("INVALID_INPUT");
  }
  return value;
}
