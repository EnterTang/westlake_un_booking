import { prisma } from "./db";
import {
  BookingError,
  hashEditCode,
  type BookingErrorCode,
  validateCancelBooking,
  validateCreateBooking,
  validateUpdateBooking,
  verifyEditCode,
} from "./validation";

export { BookingError } from "./validation";

export type CreateBookingInput = {
  slotId: string;
  userName: string;
  editCode: string;
};

export type UpdateBookingInput = {
  bookingId: string;
  editCode: string;
  slotId?: string;
  userName?: string;
};

export type CancelBookingInput = {
  bookingId: string;
  editCode: string;
};

export type BookingResult = {
  bookingId: string;
  slotId: string;
  userName: string;
  createdAt: Date;
};

type SlotRecord = {
  id: string;
  maxCapacity: number;
  reservedCount: number;
  isLocked: boolean;
};

type BookingRecord = {
  id: string;
  slotId: string;
  userName: string;
  editCodeHash: string;
  createdAt: Date;
};

type BookingTransaction = {
  slot: {
    findUnique(args: { where: { id: string } }): Promise<SlotRecord | null>;
    updateMany(args: {
      where: { id: string; isLocked?: boolean; reservedCount?: { lt?: number; gt?: number } };
      data: { reservedCount: { increment?: number; decrement?: number } };
    }): Promise<{ count: number }>;
  };
  booking: {
    create(args: { data: { slotId: string; userName: string; editCodeHash: string } }): Promise<BookingRecord>;
    findUnique(args: { where: { id: string } }): Promise<BookingRecord | null>;
    update(args: { where: { id: string }; data: { slotId?: string; userName?: string } }): Promise<BookingRecord>;
    delete(args: { where: { id: string } }): Promise<BookingRecord>;
  };
};

export type BookingDatabase = {
  $transaction<T>(callback: (transaction: BookingTransaction) => Promise<T>): Promise<T>;
};

const defaultDatabase = prisma as unknown as BookingDatabase;

export async function createBooking(
  input: CreateBookingInput,
  database: BookingDatabase = defaultDatabase,
): Promise<BookingResult> {
  const values = validateCreateBooking(input);
  const editCodeHash = hashEditCode(values.editCode);

  try {
    return await database.$transaction(async (transaction) => {
      const slot = await transaction.slot.findUnique({ where: { id: values.slotId } });
      if (!slot) throw new BookingError("SLOT_UNAVAILABLE");

      const claim = await transaction.slot.updateMany({
        where: {
          id: slot.id,
          isLocked: false,
          reservedCount: { lt: slot.maxCapacity },
        },
        data: { reservedCount: { increment: 1 } },
      });
      if (claim.count !== 1) throw new BookingError("SLOT_UNAVAILABLE");

      const booking = await transaction.booking.create({
        data: {
          slotId: slot.id,
          userName: values.userName,
          editCodeHash,
        },
      });
      return toBookingResult(booking);
    });
  } catch (error) {
    throw publicBookingError(error);
  }
}

export async function updateBooking(
  input: UpdateBookingInput,
  database: BookingDatabase = defaultDatabase,
): Promise<BookingResult> {
  const values = validateUpdateBooking(input);

  try {
    return await database.$transaction(async (transaction) => {
      const booking = await transaction.booking.findUnique({ where: { id: values.bookingId } });
      if (!booking) throw new BookingError("BOOKING_NOT_FOUND");
      if (!verifyEditCode(values.editCode, booking.editCodeHash)) {
        throw new BookingError("INVALID_EDIT_CODE");
      }

      const nextSlotId = values.slotId ?? booking.slotId;
      const nextUserName = values.userName ?? booking.userName;
      if (nextSlotId !== booking.slotId) {
        const destination = await transaction.slot.findUnique({ where: { id: nextSlotId } });
        if (!destination) throw new BookingError("SLOT_UNAVAILABLE");

        const claim = await transaction.slot.updateMany({
          where: {
            id: destination.id,
            isLocked: false,
            reservedCount: { lt: destination.maxCapacity },
          },
          data: { reservedCount: { increment: 1 } },
        });
        if (claim.count !== 1) throw new BookingError("SLOT_UNAVAILABLE");
      }

      const updated = await transaction.booking.update({
        where: { id: booking.id },
        data: { slotId: nextSlotId, userName: nextUserName },
      });

      if (nextSlotId !== booking.slotId) {
        const release = await transaction.slot.updateMany({
          where: { id: booking.slotId, reservedCount: { gt: 0 } },
          data: { reservedCount: { decrement: 1 } },
        });
        if (release.count !== 1) throw new BookingError("BOOKING_FAILED");
      }

      return toBookingResult(updated);
    });
  } catch (error) {
    throw publicBookingError(error);
  }
}

export async function cancelBooking(
  input: CancelBookingInput,
  database: BookingDatabase = defaultDatabase,
): Promise<void> {
  const values = validateCancelBooking(input);

  try {
    await database.$transaction(async (transaction) => {
      const booking = await transaction.booking.findUnique({ where: { id: values.bookingId } });
      if (!booking) throw new BookingError("BOOKING_NOT_FOUND");
      if (!verifyEditCode(values.editCode, booking.editCodeHash)) {
        throw new BookingError("INVALID_EDIT_CODE");
      }

      await transaction.booking.delete({ where: { id: booking.id } });
      const release = await transaction.slot.updateMany({
        where: { id: booking.slotId, reservedCount: { gt: 0 } },
        data: { reservedCount: { decrement: 1 } },
      });
      if (release.count !== 1) throw new BookingError("BOOKING_FAILED");
    });
  } catch (error) {
    throw publicBookingError(error);
  }
}

function toBookingResult(booking: Pick<BookingRecord, "id" | "slotId" | "userName" | "createdAt">): BookingResult {
  return {
    bookingId: booking.id,
    slotId: booking.slotId,
    userName: booking.userName,
    createdAt: booking.createdAt,
  };
}

function publicBookingError(error: unknown): BookingError {
  if (error instanceof BookingError) return error;
  if (databaseErrorCode(error) === "P2002") return new BookingError("DUPLICATE_BOOKING");
  return new BookingError("BOOKING_FAILED");
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export type { BookingErrorCode };
