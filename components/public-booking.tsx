"use client";

import { useMemo, useState } from "react";
import type { PublicEvent, PublicSlot } from "@/lib/event-api";
import { SpeakerHeader } from "@/components/speaker-header";

type SlotStatus = "Open" | "Booked" | "Locked";

function recentKey(eventId: string) {
  return `appointment:recent-bookings:${eventId}`;
}

function readRecentIds(eventId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(recentKey(eventId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeRecentIds(eventId: string, ids: string[]) {
  if (ids.length === 0) {
    localStorage.removeItem(recentKey(eventId));
    return;
  }
  localStorage.setItem(recentKey(eventId), JSON.stringify(ids));
}

function slotStatus(slot: PublicSlot): SlotStatus {
  if (slot.isLocked) return "Locked";
  if (slot.type === "ONE_ON_ONE" && slot.reservedCount >= slot.maxCapacity) return "Booked";
  if (slot.reservedCount >= slot.maxCapacity) return "Booked";
  return "Open";
}

function slotLabel(slot: PublicSlot): string {
  return `${slot.startTime}-${slot.endTime} ${slotStatus(slot)}`;
}

export function PublicBooking({ event }: { event: PublicEvent }) {
  const [liveEvent, setLiveEvent] = useState(event);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recentIds, setRecentIds] = useState(() => readRecentIds(event.id));
  const [manageBookingId, setManageBookingId] = useState("");

  const oneOnOneSlots = useMemo(
    () => liveEvent.slots.filter((slot) => slot.type === "ONE_ON_ONE"),
    [liveEvent.slots],
  );
  const groupSlots = useMemo(
    () => liveEvent.slots.filter((slot) => slot.type === "GROUP"),
    [liveEvent.slots],
  );
  const selectedSlot = liveEvent.slots.find((slot) => slot.id === selectedSlotId) ?? null;

  async function refreshEvent() {
    const response = await fetch(`/api/events/${liveEvent.id}`);
    if (!response.ok) return;
    const next = (await response.json()) as PublicEvent;
    setLiveEvent(next);
  }

  async function confirmBooking() {
    if (!selectedSlot) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/events/${liveEvent.id}/bookings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          userName,
          editCode,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { bookingId?: string; message?: string; code?: string }
        | null;
      if (!response.ok) {
        setError(payload?.message ?? "The booking could not be completed. Please try again.");
        return;
      }
      if (payload?.bookingId) {
        const nextIds = [payload.bookingId, ...recentIds.filter((id) => id !== payload.bookingId)].slice(0, 8);
        setRecentIds(nextIds);
        writeRecentIds(liveEvent.id, nextIds);
        setManageBookingId(payload.bookingId);
        setMessage(`Booking confirmed. Keep your edit code to make changes.`);
      }
      await refreshEvent();
    } finally {
      setPending(false);
    }
  }

  async function cancelManagedBooking() {
    if (!manageBookingId) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/events/${liveEvent.id}/bookings`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: manageBookingId,
          editCode,
        }),
      });
      if (response.status === 204) {
        const nextIds = recentIds.filter((id) => id !== manageBookingId);
        setRecentIds(nextIds);
        writeRecentIds(liveEvent.id, nextIds);
        setMessage("Booking cancelled.");
        setManageBookingId("");
        await refreshEvent();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? "The booking could not be cancelled.");
    } finally {
      setPending(false);
    }
  }

  function clearLocalDeviceData() {
    writeRecentIds(liveEvent.id, []);
    setRecentIds([]);
    setManageBookingId("");
    setMessage("Local device data cleared. Server bookings were not changed.");
  }

  return (
    <div className="booking-page">
      <SpeakerHeader event={liveEvent} />

      <div className="booking-layout">
        <section className="booking-slots" aria-label="Available time slots">
          <h2>One-on-one slots</h2>
          <div className="slot-grid">
            {oneOnOneSlots.map((slot) => {
              const status = slotStatus(slot);
              const disabled = status !== "Open";
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={`slot-card${selectedSlotId === slot.id ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                  aria-label={slotLabel(slot)}
                  disabled={disabled}
                  onClick={() => setSelectedSlotId(slot.id)}
                >
                  <span className="slot-time">
                    {slot.startTime}-{slot.endTime}
                  </span>
                  <span className="slot-status">{status}</span>
                </button>
              );
            })}
          </div>

          {groupSlots.length > 0 ? (
            <div className="group-section">
              <h2>Group session</h2>
              {groupSlots.map((slot) => {
                const status = slotStatus(slot);
                const disabled = status !== "Open";
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={`slot-card group-card${selectedSlotId === slot.id ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                    aria-label={slotLabel(slot)}
                    disabled={disabled}
                    onClick={() => setSelectedSlotId(slot.id)}
                  >
                    <span className="slot-time">
                      {slot.startTime}-{slot.endTime}
                    </span>
                    <span className="slot-status">{status}</span>
                    <span className="slot-capacity">
                      {slot.reservedCount}/{slot.maxCapacity} attendees
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <aside className="booking-panel">
          <h2>Book a time</h2>
          <p className="panel-copy">
            {selectedSlot
              ? `Selected ${selectedSlot.startTime}-${selectedSlot.endTime}`
              : "Choose an open slot, then enter your name and a four-digit edit code."}
          </p>

          <label className="field">
            <span>Name</span>
            <input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              autoComplete="name"
              maxLength={200}
            />
          </label>

          <label className="field">
            <span>Edit code</span>
            <input
              value={editCode}
              onChange={(event) => setEditCode(event.target.value)}
              inputMode="numeric"
              maxLength={4}
              placeholder="4 digits"
            />
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={!selectedSlot || pending}
            onClick={() => void confirmBooking()}
          >
            Confirm booking
          </button>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {message ? <p className="form-message">{message}</p> : null}

          <div className="manage-block">
            <h3>Manage a booking</h3>
            <label className="field">
              <span>Booking id</span>
              <input
                value={manageBookingId}
                onChange={(event) => setManageBookingId(event.target.value)}
                list={`recent-${liveEvent.id}`}
              />
              <datalist id={`recent-${liveEvent.id}`}>
                {recentIds.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={!manageBookingId || pending}
              onClick={() => void cancelManagedBooking()}
            >
              Cancel booking
            </button>
          </div>

          <div className="local-block">
            {recentIds.length > 0 ? (
              <p className="local-count">
                {recentIds.length} saved on this device
              </p>
            ) : null}
            <button type="button" className="text-button" onClick={clearLocalDeviceData}>
              Clear local device data
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
