import { PrismaClient, SlotType } from "@prisma/client";

const prisma = new PrismaClient();

const oneOnOneSlots = [
  ["09:00", "09:45"],
  ["09:55", "10:40"],
  ["10:50", "11:20"],
  ["13:15", "14:00"],
  ["14:10", "14:55"],
  ["15:05", "15:50"],
] as const;

async function main() {
  const event = await prisma.event.upsert({
    where: { id: "dr-xiao-jie-2026-08-04" },
    update: {},
    create: {
      id: "dr-xiao-jie-2026-08-04",
      title: "1V1 Booking with Dr. Xiao Jie",
      speaker: "Dr. Xiao Jie",
      date: new Date("2026-08-04T00:00:00+08:00"),
      venue: "Yungu Campus / TBD",
      description: "One-on-one conversations and a Student Lunch Meeting.",
      slots: {
        create: [
          ...oneOnOneSlots.map(([startTime, endTime]) => ({
            startTime,
            endTime,
            maxCapacity: 1,
            type: SlotType.ONE_ON_ONE,
          })),
          {
            startTime: "11:30",
            endTime: "13:15",
            maxCapacity: 12,
            type: SlotType.GROUP,
          },
        ],
      },
    },
  });

  console.log(`Seeded ${event.title}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
