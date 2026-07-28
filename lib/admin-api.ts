import { AuthError, requireAdmin as defaultRequireAdmin } from "./auth";
import { BookingError, releaseBooking, type BookingDatabase } from "./booking";
import { prisma } from "./db";
import { bookingStatus, readJsonBody, toPublicBookingError } from "./http";

type AdminEvent = {
  id: string;
  title: string;
  speaker: string;
  profileLink: string | null;
  avatarUrl: string | null;
  date: Date;
  venue: string;
  description: string | null;
  isPublished: boolean;
};

type AdminSlot = {
  id: string;
  eventId: string;
  displayOrder: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  reservedCount: number;
  type: "ONE_ON_ONE" | "GROUP";
  isLocked: boolean;
};

type ExportRow = {
  userName: string;
  createdAt: Date;
  slot: {
    type: "ONE_ON_ONE" | "GROUP";
    startTime: string;
    endTime: string;
  };
};

export type AdminDatabase = BookingDatabase & {
  event: {
    findMany(): Promise<AdminEvent[]>;
    findUnique(args: { where: { id: string } }): Promise<AdminEvent | null>;
    create(args: {
      data: {
        title: string;
        speaker: string;
        profileLink?: string | null;
        date: Date;
        venue: string;
        description?: string | null;
        isPublished?: boolean;
      };
    }): Promise<AdminEvent>;
    update(args: {
      where: { id: string };
      data: Partial<{
        title: string;
        speaker: string;
        profileLink: string | null;
        date: Date;
        venue: string;
        description: string | null;
        isPublished: boolean;
      }>;
    }): Promise<AdminEvent>;
  };
  slot: {
    findUnique(args: { where: { id: string } }): Promise<AdminSlot | null>;
    create(args: {
      data: {
        eventId: string;
        displayOrder?: number;
        startTime: string;
        endTime: string;
        maxCapacity?: number;
        type?: "ONE_ON_ONE" | "GROUP";
        isLocked?: boolean;
      };
    }): Promise<AdminSlot>;
    update(args: {
      where: { id: string };
      data: Partial<{
        displayOrder: number;
        startTime: string;
        endTime: string;
        maxCapacity: number;
        type: "ONE_ON_ONE" | "GROUP";
        isLocked: boolean;
      }>;
    }): Promise<AdminSlot>;
    delete(args: { where: { id: string } }): Promise<AdminSlot>;
  };
  booking: {
    findMany(args: {
      where: { slot: { eventId: string } };
      include: { slot: true };
      orderBy: { createdAt: "asc" };
    }): Promise<ExportRow[]>;
  };
};

type AdminDeps = {
  database?: AdminDatabase;
  requireAdmin?: (request: Request) => Promise<void>;
};

type BookingRouteContext = {
  params: Promise<{ bookingId: string }>;
};

type EventRouteContext = {
  params: Promise<{ eventId: string }>;
};

export function createAdminEventsHandlers(deps: AdminDeps = {}) {
  const database = deps.database ?? (prisma as unknown as AdminDatabase);
  const requireAdmin = deps.requireAdmin ?? defaultRequireAdmin;

  return {
    async GET(request: Request): Promise<Response> {
      try {
        await requireAdmin(request);
        const events = await database.event.findMany();
        return Response.json(events);
      } catch (error) {
        return adminErrorResponse(error);
      }
    },

    async POST(request: Request): Promise<Response> {
      try {
        await requireAdmin(request);
        const body = asRecord(await readJsonBody(request));
        const event = await database.event.create({
          data: {
            title: requiredString(body.title),
            speaker: requiredString(body.speaker),
            profileLink: optionalNullableString(body.profileLink) ?? null,
            date: requiredDate(body.date),
            venue: requiredString(body.venue),
            description: optionalNullableString(body.description) ?? null,
            isPublished: Boolean(body.isPublished),
          },
        });
        return Response.json(event, { status: 201 });
      } catch (error) {
        return adminErrorResponse(error);
      }
    },

    async PATCH(request: Request): Promise<Response> {
      try {
        await requireAdmin(request);
        const body = asRecord(await readJsonBody(request));
        const eventId = requiredString(body.eventId);
        const event = await database.event.update({
          where: { id: eventId },
          data: {
            ...(body.title === undefined ? {} : { title: requiredString(body.title) }),
            ...(body.speaker === undefined ? {} : { speaker: requiredString(body.speaker) }),
            ...(body.profileLink === undefined
              ? {}
              : { profileLink: optionalNullableString(body.profileLink) ?? null }),
            ...(body.date === undefined ? {} : { date: requiredDate(body.date) }),
            ...(body.venue === undefined ? {} : { venue: requiredString(body.venue) }),
            ...(body.description === undefined
              ? {}
              : { description: optionalNullableString(body.description) ?? null }),
            ...(body.isPublished === undefined ? {} : { isPublished: Boolean(body.isPublished) }),
          },
        });
        return Response.json(event);
      } catch (error) {
        return adminErrorResponse(error);
      }
    },
  };
}

export function createAdminSlotsHandlers(deps: AdminDeps = {}) {
  const database = deps.database ?? (prisma as unknown as AdminDatabase);
  const requireAdmin = deps.requireAdmin ?? defaultRequireAdmin;

  return {
    async POST(request: Request): Promise<Response> {
      try {
        await requireAdmin(request);
        const body = asRecord(await readJsonBody(request));
        const slot = await database.slot.create({
          data: {
            eventId: requiredString(body.eventId),
            displayOrder: optionalNumber(body.displayOrder) ?? 0,
            startTime: requiredString(body.startTime),
            endTime: requiredString(body.endTime),
            maxCapacity: optionalNumber(body.maxCapacity) ?? 1,
            type: optionalSlotType(body.type) ?? "ONE_ON_ONE",
            isLocked: Boolean(body.isLocked),
          },
        });
        return Response.json(slot, { status: 201 });
      } catch (error) {
        return adminErrorResponse(error);
      }
    },

    async PATCH(request: Request): Promise<Response> {
      try {
        await requireAdmin(request);
        const body = asRecord(await readJsonBody(request));
        const slot = await database.slot.update({
          where: { id: requiredString(body.slotId) },
          data: {
            ...(body.displayOrder === undefined ? {} : { displayOrder: requiredNumber(body.displayOrder) }),
            ...(body.startTime === undefined ? {} : { startTime: requiredString(body.startTime) }),
            ...(body.endTime === undefined ? {} : { endTime: requiredString(body.endTime) }),
            ...(body.maxCapacity === undefined ? {} : { maxCapacity: requiredNumber(body.maxCapacity) }),
            ...(body.type === undefined ? {} : { type: requiredSlotType(body.type) }),
            ...(body.isLocked === undefined ? {} : { isLocked: Boolean(body.isLocked) }),
          },
        });
        return Response.json(slot);
      } catch (error) {
        return adminErrorResponse(error);
      }
    },

    async DELETE(request: Request): Promise<Response> {
      try {
        await requireAdmin(request);
        const body = asRecord(await readJsonBody(request));
        await database.slot.delete({ where: { id: requiredString(body.slotId) } });
        return new Response(null, { status: 204 });
      } catch (error) {
        return adminErrorResponse(error);
      }
    },
  };
}

export function createAdminBookingHandlers(deps: AdminDeps = {}) {
  const database = deps.database ?? (prisma as unknown as AdminDatabase);
  const requireAdmin = deps.requireAdmin ?? defaultRequireAdmin;

  return {
    async DELETE(request: Request, context: BookingRouteContext): Promise<Response> {
      try {
        await requireAdmin(request);
        const { bookingId } = await context.params;
        await releaseBooking(bookingId, database);
        return new Response(null, { status: 204 });
      } catch (error) {
        return adminErrorResponse(error);
      }
    },
  };
}

export function createAdminExportHandlers(deps: AdminDeps = {}) {
  const database = deps.database ?? (prisma as unknown as AdminDatabase);
  const requireAdmin = deps.requireAdmin ?? defaultRequireAdmin;

  return {
    async GET(request: Request, context: EventRouteContext): Promise<Response> {
      try {
        await requireAdmin(request);
        const { eventId } = await context.params;
        const csv = await exportBookingsCsv(eventId, database);
        return new Response(csv, {
          status: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="bookings-${eventId}.csv"`,
          },
        });
      } catch (error) {
        return adminErrorResponse(error);
      }
    },
  };
}

export async function exportBookingsCsv(eventId: string, database: AdminDatabase): Promise<string> {
  const rows = await database.booking.findMany({
    where: { slot: { eventId } },
    include: { slot: true },
    orderBy: { createdAt: "asc" },
  });

  const lines = ["name,bookingType,timeSlot,createdAt"];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.userName),
        csvEscape(row.slot.type),
        csvEscape(`${row.slot.startTime}-${row.slot.endTime}`),
        csvEscape(row.createdAt.toISOString()),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function adminErrorResponse(error: unknown): Response {
  if (error instanceof AuthError || (typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 401)) {
    const status = error instanceof AuthError ? error.status : 401;
    const message = error instanceof Error ? error.message : "Unauthorized";
    return Response.json({ code: "UNAUTHORIZED", message }, { status });
  }
  if (error instanceof BookingError) {
    return Response.json(toPublicBookingError(error), { status: bookingStatus(error) });
  }
  return Response.json({ code: "BOOKING_FAILED", message: "Request failed." }, { status: 500 });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BookingError("INVALID_INPUT");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new BookingError("INVALID_INPUT");
  return value.trim();
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new BookingError("INVALID_INPUT");
  const trimmed = value.trim();
  return trimmed || null;
}

function requiredDate(value: unknown): Date {
  if (typeof value !== "string" && !(value instanceof Date)) throw new BookingError("INVALID_INPUT");
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new BookingError("INVALID_INPUT");
  return date;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  return requiredNumber(value);
}

function requiredNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new BookingError("INVALID_INPUT");
  return value;
}

function optionalSlotType(value: unknown): "ONE_ON_ONE" | "GROUP" | undefined {
  if (value === undefined) return undefined;
  return requiredSlotType(value);
}

function requiredSlotType(value: unknown): "ONE_ON_ONE" | "GROUP" {
  if (value !== "ONE_ON_ONE" && value !== "GROUP") throw new BookingError("INVALID_INPUT");
  return value;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
