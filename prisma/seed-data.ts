export const SEEDED_EVENT_ID = "dr-xiao-jie-2026-08-04";

const oneOnOneSlots = [
  ["09:00", "09:45"],
  ["09:55", "10:40"],
  ["10:50", "11:20"],
  ["13:15", "14:00"],
  ["14:10", "14:55"],
  ["15:05", "15:50"],
] as const;

export type SeedSlot = {
  displayOrder: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  type: "ONE_ON_ONE" | "GROUP";
};

export type SeedEvent = {
  id: string;
  title: string;
  speaker: string;
  profileLink: string;
  date: Date;
  venue: string;
  description: string;
  isPublished: boolean;
  slots: SeedSlot[];
};

export function buildSeedEvent(): SeedEvent {
  return {
    id: SEEDED_EVENT_ID,
    title: "1V1 Booking with Dr. Xiao Jie",
    speaker: "Dr. Xiao Jie",
    profileLink: "https://example.com/speakers/xiao-jie",
    date: new Date("2026-08-04T00:00:00+08:00"),
    venue: "Yungu Campus / TBD",
    description: "One-on-one conversations and a Student Lunch Meeting.",
    isPublished: true,
    slots: [
      ...oneOnOneSlots.map(([startTime, endTime], index) => ({
        displayOrder: index,
        startTime,
        endTime,
        maxCapacity: 1,
        type: "ONE_ON_ONE" as const,
      })),
      {
        displayOrder: oneOnOneSlots.length,
        startTime: "11:30",
        endTime: "13:15",
        maxCapacity: 12,
        type: "GROUP",
      },
    ],
  };
}
