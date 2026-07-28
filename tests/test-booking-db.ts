type SlotRecord = {
  id: string;
  eventId: string;
  maxCapacity: number;
  reservedCount: number;
  isLocked: boolean;
  displayOrder: number;
  startTime: string;
  endTime: string;
  type: "ONE_ON_ONE" | "GROUP";
};

type BookingRecord = {
  id: string;
  slotId: string;
  userName: string;
  passcodeHash: string;
  createdAt: Date;
  updatedAt: Date;
};

type EventRecord = {
  id: string;
  title: string;
  speaker: string;
  profileLink: string | null;
  date: Date;
  venue: string;
  description: string | null;
  isPublished: boolean;
};

type SlotWhere = {
  id: string;
  isLocked?: boolean;
  reservedCount?: { lt?: number; gt?: number };
};

type SlotSeed = {
  id: string;
  maxCapacity: number;
  eventId?: string;
  reservedCount?: number;
  isLocked?: boolean;
  displayOrder?: number;
  startTime?: string;
  endTime?: string;
  type?: "ONE_ON_ONE" | "GROUP";
};

export class TestBookingDatabase {
  private readonly events = new Map<string, EventRecord>();
  private readonly slots = new Map<string, SlotRecord>();
  private readonly bookings = new Map<string, BookingRecord>();
  private nextBookingId = 1;

  constructor(slots: SlotSeed[]) {
    for (const slot of slots) {
      this.slots.set(slot.id, {
        id: slot.id,
        eventId: slot.eventId ?? "event-1",
        maxCapacity: slot.maxCapacity,
        reservedCount: slot.reservedCount ?? 0,
        isLocked: slot.isLocked ?? false,
        displayOrder: slot.displayOrder ?? 0,
        startTime: slot.startTime ?? "09:00",
        endTime: slot.endTime ?? "09:45",
        type: slot.type ?? "ONE_ON_ONE",
      });
    }
  }

  publishEvent(event: EventRecord) {
    this.events.set(event.id, { ...event });
  }

  async seedBooking(data: { slotId: string; userName: string; passcodeHash: string }) {
    const slot = this.slots.get(data.slotId);
    if (!slot) throw new Error("slot missing");
    slot.reservedCount += 1;
    await this.booking.create({ data });
  }

  async $transaction<T>(callback: (transaction: this) => Promise<T>): Promise<T> {
    return callback(this);
  }

  event = {
    findMany: async () => [...this.events.values()].map((event) => ({ ...event })),
    findUnique: async ({
      where,
      include,
    }: {
      where: { id: string };
      include?: {
        slots?: {
          include?: { bookings?: { select?: { userName?: boolean } } };
          orderBy?: { displayOrder: "asc" | "desc" };
        };
      };
    }) => {
      const event = this.events.get(where.id);
      if (!event) return null;
      if (!include?.slots) return { ...event };

      const slots = [...this.slots.values()]
        .filter((slot) => slot.eventId === event.id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((slot) => ({
          ...slot,
          bookings: include.slots?.include?.bookings
            ? [...this.bookings.values()]
                .filter((booking) => booking.slotId === slot.id)
                .map((booking) =>
                  include.slots?.include?.bookings?.select?.userName
                    ? { userName: booking.userName }
                    : { ...booking },
                )
            : undefined,
        }));

      return { ...event, slots };
    },
    create: async ({
      data,
    }: {
      data: {
        title: string;
        speaker: string;
        profileLink?: string | null;
        date: Date;
        venue: string;
        description?: string | null;
        isPublished?: boolean;
      };
    }) => {
      const event = {
        id: `event-${this.events.size + 1}`,
        title: data.title,
        speaker: data.speaker,
        profileLink: data.profileLink ?? null,
        date: data.date,
        venue: data.venue,
        description: data.description ?? null,
        isPublished: data.isPublished ?? false,
      };
      this.events.set(event.id, event);
      return { ...event };
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<EventRecord>;
    }) => {
      const event = this.events.get(where.id);
      if (!event) throw new Error("Event missing");
      Object.assign(event, data);
      return { ...event };
    },
  };

  slot = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const slot = this.slots.get(where.id);
      return slot ? { ...slot } : null;
    },
    findFirst: async ({ where }: { where: { id: string; eventId: string } }) => {
      const slot = this.slots.get(where.id);
      if (!slot || slot.eventId !== where.eventId) return null;
      return { ...slot };
    },
    create: async ({
      data,
    }: {
      data: {
        eventId: string;
        displayOrder?: number;
        startTime: string;
        endTime: string;
        maxCapacity?: number;
        type?: "ONE_ON_ONE" | "GROUP";
        isLocked?: boolean;
      };
    }) => {
      const slot: SlotRecord = {
        id: `slot-${this.slots.size + 1}`,
        eventId: data.eventId,
        displayOrder: data.displayOrder ?? 0,
        startTime: data.startTime,
        endTime: data.endTime,
        maxCapacity: data.maxCapacity ?? 1,
        reservedCount: 0,
        type: data.type ?? "ONE_ON_ONE",
        isLocked: data.isLocked ?? false,
      };
      this.slots.set(slot.id, slot);
      return { ...slot };
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Omit<SlotRecord, "id" | "eventId" | "reservedCount">>;
    }) => {
      const slot = this.slots.get(where.id);
      if (!slot) throw new Error("Slot missing");
      Object.assign(slot, data);
      return { ...slot };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const slot = this.slots.get(where.id);
      if (!slot) throw new Error("Slot missing");
      this.slots.delete(where.id);
      return slot;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: SlotWhere;
      data: { reservedCount: { increment?: number; decrement?: number } };
    }) => {
      const slot = this.slots.get(where.id);
      if (!slot || !this.matchesSlot(slot, where)) return { count: 0 };

      slot.reservedCount += data.reservedCount.increment ?? 0;
      slot.reservedCount -= data.reservedCount.decrement ?? 0;
      return { count: 1 };
    },
  };

  booking = {
    create: async ({ data }: { data: Omit<BookingRecord, "id" | "createdAt" | "updatedAt"> }) => {
      const duplicate = [...this.bookings.values()].some(
        (booking) => booking.slotId === data.slotId && booking.userName === data.userName,
      );
      if (duplicate) {
        throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
      }

      const now = new Date();
      const booking = {
        ...data,
        id: `booking-${this.nextBookingId++}`,
        createdAt: now,
        updatedAt: now,
      };
      this.bookings.set(booking.id, booking);
      return { ...booking };
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const booking = this.bookings.get(where.id);
      return booking ? { ...booking } : null;
    },
    findMany: async ({
      where,
    }: {
      where: { slot: { eventId: string } };
      include: { slot: true };
      orderBy: { createdAt: "asc" };
    }) => {
      return [...this.bookings.values()]
        .map((booking) => {
          const slot = this.slots.get(booking.slotId);
          if (!slot || slot.eventId !== where.slot.eventId) return null;
          return {
            userName: booking.userName,
            createdAt: booking.createdAt,
            slot: {
              type: slot.type,
              startTime: slot.startTime,
              endTime: slot.endTime,
            },
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Pick<BookingRecord, "slotId" | "userName">>;
    }) => {
      const booking = this.bookings.get(where.id);
      if (!booking) throw new Error("Booking missing");
      Object.assign(booking, data, { updatedAt: new Date() });
      return { ...booking };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const booking = this.bookings.get(where.id);
      if (!booking) throw new Error("Booking missing");
      this.bookings.delete(where.id);
      return booking;
    },
  };

  reservedCount(slotId: string): number {
    return this.slots.get(slotId)?.reservedCount ?? -1;
  }

  listBookings(): BookingRecord[] {
    return [...this.bookings.values()].map((booking) => ({ ...booking }));
  }

  private matchesSlot(slot: SlotRecord, where: SlotWhere): boolean {
    if (where.isLocked !== undefined && slot.isLocked !== where.isLocked) return false;
    if (where.reservedCount?.lt !== undefined && slot.reservedCount >= where.reservedCount.lt) return false;
    if (where.reservedCount?.gt !== undefined && slot.reservedCount <= where.reservedCount.gt) return false;
    return true;
  }
}
