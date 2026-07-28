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
  const lunchSlot = groupSlots[0] ?? null;
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
        setMessage("Booking confirmed. Keep your edit code to make changes.");
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
    <div className="wl-page">
      <SpeakerHeader event={liveEvent} lunchSlot={lunchSlot} />

      <div className="wl-layout">
        <div className="wl-main">
          <section className="wl-card wl-slots-card" aria-label="Available time slots">
            <h2 className="wl-section-title">One-on-One Slots</h2>
            <p className="wl-section-copy">Select an open slot, then confirm on the right.</p>
            <div className="wl-slot-list">
              {oneOnOneSlots.map((slot) => {
                const status = slotStatus(slot);
                const disabled = status !== "Open";
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={`wl-slot-row${selectedSlotId === slot.id ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                    aria-label={slotLabel(slot)}
                    disabled={disabled}
                    onClick={() => setSelectedSlotId(slot.id)}
                  >
                    <span className="wl-slot-copy">
                      <span className="wl-slot-time">
                        {slot.startTime}-{slot.endTime}
                      </span>
                      <span className="wl-slot-hint">{disabled ? status : "Click to reserve"}</span>
                    </span>
                    <span className={`wl-status-pill is-${status.toLowerCase()}`}>{status}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {lunchSlot ? (
            <section className="wl-lunch-card">
              <h2 className="wl-section-title">Student Lunch Meeting</h2>
              <p className="wl-section-copy">
                Join a shared conversation with Dr. Xiao Jie and other students.
              </p>
              <p className="wl-lunch-meta">
                <strong>Time</strong> {lunchSlot.startTime}-{lunchSlot.endTime}
                <br />
                <strong>Venue</strong> {liveEvent.venue}
              </p>
              <button
                type="button"
                className="wl-primary-btn"
                aria-label={slotLabel(lunchSlot)}
                disabled={slotStatus(lunchSlot) !== "Open" || pending}
                onClick={() => setSelectedSlotId(lunchSlot.id)}
              >
                Join Student Lunch Meeting
              </button>
              <p className="wl-lunch-footer">
                {lunchSlot.reservedCount === 0
                  ? "No Student Lunch Meeting signups yet."
                  : `${lunchSlot.reservedCount}/${lunchSlot.maxCapacity} attendees`}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="wl-card wl-side-card">
          <h2 className="wl-section-title">Reserve a Slot</h2>
          <p className="wl-section-copy">
            {selectedSlot
              ? `Selected ${selectedSlot.startTime}-${selectedSlot.endTime}`
              : "Choose an open slot, then enter your name and a four-digit edit code."}
          </p>

          <label className="wl-field">
            <span>Your name</span>
            <input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              autoComplete="name"
              maxLength={200}
            />
          </label>

          <label className="wl-field">
            <span>4-digit edit code</span>
            <input
              value={editCode}
              onChange={(event) => setEditCode(event.target.value)}
              inputMode="numeric"
              maxLength={4}
              placeholder="For later edit/cancel"
            />
          </label>

          <button
            type="button"
            className="wl-primary-btn"
            disabled={!selectedSlot || pending}
            onClick={() => void confirmBooking()}
          >
            Confirm Booking
          </button>

          {error ? <p className="wl-error" role="alert">{error}</p> : null}
          {message ? <p className="wl-success">{message}</p> : null}

          <div className="wl-manage">
            <p className="wl-section-copy">
              To edit or cancel later, keep your booking id and the same 4-digit edit code.
            </p>
            <label className="wl-field">
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
              className="wl-primary-btn wl-primary-btn-muted"
              disabled={!manageBookingId || pending}
              onClick={() => void cancelManagedBooking()}
            >
              Cancel booking
            </button>
          </div>

          <div className="wl-reset-box">
            <p>Need to clear all local test data on this device?</p>
            {recentIds.length > 0 ? (
              <p className="wl-local-count">{recentIds.length} saved on this device</p>
            ) : null}
            <button type="button" className="wl-primary-btn" onClick={clearLocalDeviceData}>
              Reset Local Bookings
            </button>
          </div>

          <p className="wl-footnote">
            Local booking ids stay on this device only. Questions: Tianyang Chen.
          </p>
        </aside>
      </div>
    </div>
  );
}
