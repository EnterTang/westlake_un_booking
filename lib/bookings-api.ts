import {
  BookingError,
  cancelBooking,
  createBooking,
  type BookingDatabase,
  updateBooking,
} from "./booking";
import { prisma } from "./db";
import { bookingStatus, readJsonBody, toPublicBookingError } from "./http";
import { limitBookingRequest, type RateLimitResult } from "./rate-limit";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

type BookingApiDatabase = BookingDatabase & {
  event: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; isPublished: boolean } | null>;
  };
  slot: {
    findFirst(args: {
      where: { id: string; eventId: string };
    }): Promise<{ id: string } | null>;
  };
};

export type BookingRouteDeps = {
  database?: BookingApiDatabase;
  rateLimit?: (request: Request) => Promise<RateLimitResult>;
};

export function createBookingRouteHandlers(deps: BookingRouteDeps = {}) {
  const database = deps.database ?? (prisma as unknown as BookingApiDatabase);
  const rateLimit = deps.rateLimit ?? limitBookingRequest;

  return {
    async POST(request: Request, context: RouteContext): Promise<Response> {
      const limited = await rateLimit(request);
      if (!limited.allowed) {
        return Response.json({ code: "RATE_LIMITED", message: "Too many booking attempts. Please try again later." }, { status: 429 });
      }

      try {
        const { eventId } = await context.params;
        await requirePublishedEvent(database, eventId);
        const body = asRecord(await readJsonBody(request));
        const slotId = requiredString(body.slotId);
        await requireEventSlot(database, eventId, slotId);

        const booking = await createBooking(
          {
            slotId,
            userName: requiredString(body.userName),
            editCode: requiredString(body.editCode),
          },
          database,
        );
        return Response.json(booking, { status: 201 });
      } catch (error) {
        return Response.json(toPublicBookingError(error), { status: bookingStatus(error) });
      }
    },

    async PATCH(request: Request, context: RouteContext): Promise<Response> {
      const limited = await rateLimit(request);
      if (!limited.allowed) {
        return Response.json({ code: "RATE_LIMITED", message: "Too many booking attempts. Please try again later." }, { status: 429 });
      }

      try {
        const { eventId } = await context.params;
        await requirePublishedEvent(database, eventId);
        const body = asRecord(await readJsonBody(request));
        const slotId = optionalString(body.slotId);
        if (slotId !== undefined) await requireEventSlot(database, eventId, slotId);

        const userName = optionalString(body.userName);
        const booking = await updateBooking(
          {
            bookingId: requiredString(body.bookingId),
            editCode: requiredString(body.editCode),
            ...(slotId === undefined ? {} : { slotId }),
            ...(userName === undefined ? {} : { userName }),
          },
          database,
        );
        return Response.json(booking, { status: 200 });
      } catch (error) {
        return Response.json(toPublicBookingError(error), { status: bookingStatus(error) });
      }
    },

    async DELETE(request: Request, context: RouteContext): Promise<Response> {
      const limited = await rateLimit(request);
      if (!limited.allowed) {
        return Response.json({ code: "RATE_LIMITED", message: "Too many booking attempts. Please try again later." }, { status: 429 });
      }

      try {
        const { eventId } = await context.params;
        await requirePublishedEvent(database, eventId);
        const body = asRecord(await readJsonBody(request));
        await cancelBooking(
          {
            bookingId: requiredString(body.bookingId),
            editCode: requiredString(body.editCode),
          },
          database,
        );
        return new Response(null, { status: 204 });
      } catch (error) {
        return Response.json(toPublicBookingError(error), { status: bookingStatus(error) });
      }
    },
  };
}

async function requirePublishedEvent(database: BookingApiDatabase, eventId: string) {
  const event = await database.event.findUnique({ where: { id: eventId } });
  if (!event || !event.isPublished) throw new BookingError("SLOT_UNAVAILABLE");
}

async function requireEventSlot(database: BookingApiDatabase, eventId: string, slotId: string) {
  const slot = await database.slot.findFirst({ where: { id: slotId, eventId } });
  if (!slot) throw new BookingError("SLOT_UNAVAILABLE");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BookingError("INVALID_INPUT");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") throw new BookingError("INVALID_INPUT");
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new BookingError("INVALID_INPUT");
  return value;
}
