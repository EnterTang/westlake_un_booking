import { redirect } from "next/navigation";
import { SEEDED_EVENT_ID } from "@/prisma/seed-data";

export default function HomePage() {
  redirect(`/events/${SEEDED_EVENT_ID}`);
}
