import { prisma } from "./db";

export type PublicBookingDisplay = {
  userName: string;
};

export type PublicSlot = {
  id: string;
  displayOrder: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  reservedCount: number;
  type: "ONE_ON_ONE" | "GROUP";
  isLocked: boolean;
  bookings: PublicBookingDisplay[];
};

export type PublicEvent = {
  id: string;
  title: string;
  speaker: string;
  profileLink: string | null;
  avatarUrl: string | null;
  date: string | Date;
  venue: string;
  description: string | null;
  isPublished: boolean;
  slots: PublicSlot[];
};

export type EventDatabase = {
  event: {
    findUnique(args: {
      where: { id: string };
      include: {
        slots: {
          orderBy: { displayOrder: "asc" };
          include: {
            bookings: {
              select: { userName: true };
            };
          };
        };
      };
    }): Promise<{
      id: string;
      title: string;
      speaker: string;
      profileLink: string | null;
      avatarUrl: string | null;
      date: Date;
      venue: string;
      description: string | null;
      isPublished: boolean;
      slots: Array<{
        id: string;
        displayOrder: number;
        startTime: string;
        endTime: string;
        maxCapacity: number;
        reservedCount: number;
        type: "ONE_ON_ONE" | "GROUP";
        isLocked: boolean;
        bookings: Array<{ userName: string }>;
      }>;
    } | null>;
  };
};

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export type EventRouteDeps = {
  database?: EventDatabase;
};

export async function loadPublicEvent(
  eventId: string,
  database: EventDatabase = prisma as unknown as EventDatabase,
): Promise<PublicEvent | null> {
  const event = await database.event.findUnique({
    where: { id: eventId },
    include: {
      slots: {
        orderBy: { displayOrder: "asc" },
        include: {
          bookings: {
            select: { userName: true },
          },
        },
      },
    },
  });

  if (!event || !event.isPublished) return null;

  return {
    id: event.id,
    title: event.title,
    speaker: event.speaker,
    profileLink: event.profileLink,
    avatarUrl: event.avatarUrl,
    date: event.date,
    venue: event.venue,
    description: event.description,
    isPublished: event.isPublished,
    slots: event.slots.map((slot) => ({
      id: slot.id,
      displayOrder: slot.displayOrder,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxCapacity: slot.maxCapacity,
      reservedCount: slot.reservedCount,
      type: slot.type,
      isLocked: slot.isLocked,
      bookings: slot.bookings.map((booking) => ({ userName: booking.userName })),
    })),
  };
}

export function createEventRouteHandlers(deps: EventRouteDeps = {}) {
  const database = deps.database ?? (prisma as unknown as EventDatabase);

  return {
    async GET(_request: Request, context: RouteContext): Promise<Response> {
      const { eventId } = await context.params;
      const payload = await loadPublicEvent(eventId, database);

      if (!payload) {
        return Response.json({ code: "EVENT_NOT_FOUND", message: "Event not found." }, { status: 404 });
      }

      return Response.json(payload);
    },
  };
}
