import { notFound } from "next/navigation";
import { PublicBooking } from "@/components/public-booking";
import { loadPublicEvent } from "@/lib/event-api";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function PublicEventPage({ params }: PageProps) {
  const { eventId } = await params;
  const event = await loadPublicEvent(eventId);
  if (!event) notFound();

  const serializable = {
    ...event,
    date: event.date instanceof Date ? event.date.toISOString() : event.date,
  };

  return <PublicBooking event={serializable} />;
}
