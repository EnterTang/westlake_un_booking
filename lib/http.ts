import { BookingError, type BookingErrorCode } from "./validation";

const statusByCode: Record<BookingErrorCode, number> = {
  INVALID_INPUT: 400,
  SLOT_UNAVAILABLE: 409,
  BOOKING_NOT_FOUND: 404,
  INVALID_EDIT_CODE: 403,
  DUPLICATE_BOOKING: 409,
  BOOKING_FAILED: 500,
};

export function bookingStatus(error: unknown): number {
  if (error instanceof BookingError) return statusByCode[error.code];
  return 500;
}

export function toPublicBookingError(error: unknown): { code: BookingErrorCode | "BOOKING_FAILED"; message: string } {
  if (error instanceof BookingError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "BOOKING_FAILED",
    message: "The booking could not be completed. Please try again.",
  };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BookingError("INVALID_INPUT");
  }
}
