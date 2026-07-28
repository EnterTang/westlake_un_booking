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
  updatedAt: Date;
};

type SlotWhere = {
  id: string;
  isLocked?: boolean;
  reservedCount?: { lt?: number; gt?: number };
};

export class TestBookingDatabase {
  private readonly slots = new Map<string, SlotRecord>();
  private readonly bookings = new Map<string, BookingRecord>();
  private nextBookingId = 1;

  constructor(slots: Array<Omit<SlotRecord, "reservedCount" | "isLocked"> & Partial<Pick<SlotRecord, "reservedCount" | "isLocked">>>) {
    for (const slot of slots) {
      this.slots.set(slot.id, {
        ...slot,
        reservedCount: slot.reservedCount ?? 0,
        isLocked: slot.isLocked ?? false,
      });
    }
  }

  async $transaction<T>(callback: (transaction: this) => Promise<T>): Promise<T> {
    return callback(this);
  }

  slot = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const slot = this.slots.get(where.id);
      return slot ? { ...slot } : null;
    },
    updateMany: async ({ where, data }: { where: SlotWhere; data: { reservedCount: { increment?: number; decrement?: number } } }) => {
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
    update: async ({ where, data }: { where: { id: string }; data: Partial<Pick<BookingRecord, "slotId" | "userName">> }) => {
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

  private matchesSlot(slot: SlotRecord, where: SlotWhere): boolean {
    if (where.isLocked !== undefined && slot.isLocked !== where.isLocked) return false;
    if (where.reservedCount?.lt !== undefined && slot.reservedCount >= where.reservedCount.lt) return false;
    if (where.reservedCount?.gt !== undefined && slot.reservedCount <= where.reservedCount.gt) return false;
    return true;
  }
}
