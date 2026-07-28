"use client";

import { useMemo, useState } from "react";

export type AdminBookingView = {
  id: string;
  userName: string;
  createdAt: string;
};

export type AdminSlotView = {
  id: string;
  eventId: string;
  displayOrder: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  reservedCount: number;
  type: "ONE_ON_ONE" | "GROUP";
  isLocked: boolean;
  bookings: AdminBookingView[];
};

export type AdminEventView = {
  id: string;
  title: string;
  speaker: string;
  profileLink: string | null;
  avatarUrl: string | null;
  date: string;
  venue: string;
  description: string | null;
  isPublished: boolean;
  slots: AdminSlotView[];
};

export function AdminConsole({ initialEvents }: { initialEvents: AdminEventView[] }) {
  const [events] = useState(initialEvents);
  const [selectedEventId, setSelectedEventId] = useState(initialEvents[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selected = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  async function refresh() {
    window.location.reload();
  }


  async function uploadAvatar(file: File) {
    if (!selected) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("avatar", file);
      const response = await fetch(`/api/admin/events/${selected.id}/avatar`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        setError("Could not upload avatar.");
        return;
      }
      setMessage("Avatar uploaded.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function clearAvatar() {
    if (!selected) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/events/${selected.id}/avatar`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("Could not clear avatar.");
        return;
      }
      setMessage("Avatar cleared.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function saveEvent(form: HTMLFormElement) {
    if (!selected) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const data = new FormData(form);
    try {
      const response = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: selected.id,
          title: String(data.get("title") ?? ""),
          speaker: String(data.get("speaker") ?? ""),
          profileLink: String(data.get("profileLink") ?? "") || null,
          date: String(data.get("date") ?? ""),
          venue: String(data.get("venue") ?? ""),
          description: String(data.get("description") ?? "") || null,
          isPublished: data.get("isPublished") === "on",
        }),
      });
      if (!response.ok) {
        setError("Could not save event.");
        return;
      }
      setMessage("Event saved.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function addSlot(form: HTMLFormElement) {
    if (!selected) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const data = new FormData(form);
    try {
      const response = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: selected.id,
          startTime: String(data.get("startTime") ?? ""),
          endTime: String(data.get("endTime") ?? ""),
          maxCapacity: Number(data.get("maxCapacity") ?? 1),
          type: String(data.get("type") ?? "ONE_ON_ONE"),
          displayOrder: selected.slots.length,
        }),
      });
      if (!response.ok) {
        setError("Could not create slot.");
        return;
      }
      form.reset();
      setMessage("Slot created.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function patchSlot(slotId: string, patch: Record<string, unknown>) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/slots", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId, ...patch }),
      });
      if (!response.ok) {
        setError("Could not update slot.");
        return;
      }
      setMessage("Slot updated.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function deleteSlot(slotId: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/slots", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId }),
      });
      if (!response.ok) {
        setError("Could not delete slot.");
        return;
      }
      setMessage("Slot deleted.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function releaseBooking(bookingId: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, { method: "DELETE" });
      if (!response.ok) {
        setError("Could not release booking.");
        return;
      }
      setMessage("Booking released.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  const openCapacity = selected
    ? selected.slots.reduce((sum, slot) => sum + Math.max(slot.maxCapacity - slot.reservedCount, 0), 0)
    : 0;
  const bookedNames = selected
    ? selected.slots.flatMap((slot) => slot.bookings.map((booking) => booking.userName))
    : [];

  return (
    <div className="admin-console">
      <label className="field event-picker">
        <span>Event</span>
        <select
          value={selectedEventId}
          onChange={(event) => setSelectedEventId(event.target.value)}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>

      {!selected ? <p>No events yet. Seed the database to begin.</p> : null}

      {selected ? (
        <>
          <section className="admin-summary">
            <p>
              Public link: <a href={`/events/${selected.id}`}>/events/{selected.id}</a>
            </p>
            <p>
              Open capacity: {openCapacity}    Booked names: {bookedNames.length ? bookedNames.join(", ") : "none"}
            </p>
            <p>
              <a href={`/api/admin/events/${selected.id}/export`}>Download CSV export</a>
            </p>
          </section>

          <section className="admin-panel">
            <h2>Event details</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveEvent(event.currentTarget);
              }}
            >
              <label className="field">
                <span>Title</span>
                <input name="title" defaultValue={selected.title} required />
              </label>
              <label className="field">
                <span>Speaker</span>
                <input name="speaker" defaultValue={selected.speaker} required />
              </label>
              <label className="field">
                <span>Profile link</span>
                <input name="profileLink" defaultValue={selected.profileLink ?? ""} />
              </label>

              <div className="admin-avatar-block">
                <span className="field"><span>Speaker avatar</span></span>
                {selected.avatarUrl ? (
                  <img className="admin-avatar-preview" src={selected.avatarUrl} alt="" width={96} height={96} />
                ) : (
                  <p className="admin-summary">No custom avatar yet. Default public image will be used.</p>
                )}
                <label className="field">
                  <span>Upload image (JPG/PNG/WebP, max 1.5MB)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={pending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAvatar(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {selected.avatarUrl ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={pending}
                    onClick={() => void clearAvatar()}
                  >
                    Remove avatar
                  </button>
                ) : null}
              </div>
              <label className="field">
                <span>Date</span>
                <input name="date" type="datetime-local" defaultValue={toLocalInput(selected.date)} required />
              </label>
              <label className="field">
                <span>Venue</span>
                <input name="venue" defaultValue={selected.venue} required />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea name="description" defaultValue={selected.description ?? ""} rows={3} />
              </label>
              <label className="checkbox-field">
                <input name="isPublished" type="checkbox" defaultChecked={selected.isPublished} />
                <span>Published</span>
              </label>
              <button type="submit" className="primary-button" disabled={pending}>
                Save event
              </button>
            </form>
          </section>

          <section className="admin-panel">
            <h2>Slots</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Reserved</th>
                  <th>Locked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selected.slots.map((slot) => (
                  <tr key={slot.id}>
                    <td>{slot.displayOrder}</td>
                    <td>
                      {slot.startTime}-{slot.endTime}
                    </td>
                    <td>{slot.type}</td>
                    <td>{slot.maxCapacity}</td>
                    <td>{slot.reservedCount}</td>
                    <td>{slot.isLocked ? "Yes" : "No"}</td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="text-button"
                        disabled={pending}
                        onClick={() => void patchSlot(slot.id, { isLocked: !slot.isLocked })}
                      >
                        {slot.isLocked ? "Unlock" : "Lock"}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={pending}
                        onClick={() => void patchSlot(slot.id, { displayOrder: Math.max(slot.displayOrder - 1, 0) })}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={pending}
                        onClick={() => void patchSlot(slot.id, { displayOrder: slot.displayOrder + 1 })}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={pending || slot.reservedCount > 0}
                        onClick={() => void deleteSlot(slot.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <form
              className="slot-create"
              onSubmit={(event) => {
                event.preventDefault();
                void addSlot(event.currentTarget);
              }}
            >
              <h3>Add slot</h3>
              <div className="slot-create-grid">
                <label className="field">
                  <span>Start</span>
                  <input name="startTime" placeholder="09:00" required />
                </label>
                <label className="field">
                  <span>End</span>
                  <input name="endTime" placeholder="09:45" required />
                </label>
                <label className="field">
                  <span>Capacity</span>
                  <input name="maxCapacity" type="number" min={1} defaultValue={1} required />
                </label>
                <label className="field">
                  <span>Type</span>
                  <select name="type" defaultValue="ONE_ON_ONE">
                    <option value="ONE_ON_ONE">ONE_ON_ONE</option>
                    <option value="GROUP">GROUP</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="secondary-button" disabled={pending}>
                Add slot
              </button>
            </form>
          </section>

          <section className="admin-panel">
            <h2>Bookings</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slot</th>
                  <th>Created</th>
                  <th>Release</th>
                </tr>
              </thead>
              <tbody>
                {selected.slots.flatMap((slot) =>
                  slot.bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.userName}</td>
                      <td>
                        {slot.startTime}-{slot.endTime} ({slot.type})
                      </td>
                      <td>{new Date(booking.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          disabled={pending}
                          onClick={() => void releaseBooking(booking.id)}
                        >
                          Release
                        </button>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
