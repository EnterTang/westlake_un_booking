import type { PublicEvent, PublicSlot } from "@/lib/event-api";

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

export function SpeakerHeader({
  event,
  lunchSlot,
}: {
  event: PublicEvent;
  lunchSlot?: PublicSlot | null;
}) {
  const lunchTime = lunchSlot ? `${lunchSlot.startTime}-${lunchSlot.endTime}` : "TBD";

  return (
    <header className="wl-hero">
      <div className="wl-hero-main">
        <p className="wl-kicker">Westlake University · 1:1 Booking</p>
        <h1 className="wl-title">{event.title}</h1>
        {event.profileLink ? (
          <a className="wl-profile-link" href={event.profileLink} target="_blank" rel="noreferrer">
            View {event.speaker}&apos;s Profile <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        <p className="wl-lead">
          {event.description ??
            "Book a short one-on-one conversation, or join the student lunch meeting. Each 1:1 slot accepts one active booking."}
        </p>
        <div className="wl-meta-grid">
          <div className="wl-meta-cell">
            <span className="wl-meta-label">Date</span>
            <span className="wl-meta-value">{formatEventDate(event.date)}</span>
          </div>
          <div className="wl-meta-cell">
            <span className="wl-meta-label">Venue</span>
            <span className="wl-meta-value">{event.venue}</span>
          </div>
          <div className="wl-meta-cell">
            <span className="wl-meta-label">Student Lunch Meeting</span>
            <span className="wl-meta-value">{lunchTime}</span>
          </div>
          <div className="wl-meta-cell">
            <span className="wl-meta-label">Format</span>
            <span className="wl-meta-value">One active 1:1 booking per slot</span>
          </div>
        </div>
      </div>
      <div className="wl-hero-photo">
        <img
          src={event.avatarUrl || "/speakers/xiao-jie.png"}
          alt={event.speaker}
          width={180}
          height={180}
        />
      </div>
    </header>
  );
}
