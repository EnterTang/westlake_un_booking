import type { PublicEvent } from "@/lib/event-api";

function formatEventDate(date: string | Date): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(value);
}

export function SpeakerHeader({ event }: { event: PublicEvent }) {
  return (
    <header className="speaker-header">
      <p className="speaker-kicker">Appointment booking</p>
      <h1 className="speaker-name">{event.speaker}</h1>
      <p className="speaker-title">{event.title}</p>
      <p className="speaker-meta">
        {formatEventDate(event.date)} / {event.venue}
      </p>
      {event.description ? <p className="speaker-description">{event.description}</p> : null}
      {event.profileLink ? (
        <p>
          <a className="speaker-link" href={event.profileLink} target="_blank" rel="noreferrer">
            Speaker profile
          </a>
        </p>
      ) : null}
    </header>
  );
}
