import { PrismaClient, SlotType } from "@prisma/client";
import { buildSeedEvent } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  const seed = buildSeedEvent();

  const event = await prisma.event.upsert({
    where: { id: seed.id },
    update: {
      title: seed.title,
      speaker: seed.speaker,
      profileLink: seed.profileLink,
      date: seed.date,
      venue: seed.venue,
      description: seed.description,
      isPublished: seed.isPublished,
    },
    create: {
      id: seed.id,
      title: seed.title,
      speaker: seed.speaker,
      profileLink: seed.profileLink,
      date: seed.date,
      venue: seed.venue,
      description: seed.description,
      isPublished: seed.isPublished,
      slots: {
        create: seed.slots.map((slot) => ({
          displayOrder: slot.displayOrder,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxCapacity: slot.maxCapacity,
          type: slot.type === "GROUP" ? SlotType.GROUP : SlotType.ONE_ON_ONE,
        })),
      },
    },
  });

  const existingSlots = await prisma.slot.count({ where: { eventId: event.id } });
  if (existingSlots === 0) {
    await prisma.slot.createMany({
      data: seed.slots.map((slot) => ({
        eventId: event.id,
        displayOrder: slot.displayOrder,
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxCapacity: slot.maxCapacity,
        type: slot.type === "GROUP" ? SlotType.GROUP : SlotType.ONE_ON_ONE,
      })),
    });
  }

  console.log(`Seeded ${event.title}. Public URL: /events/${event.id}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
