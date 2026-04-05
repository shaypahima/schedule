"use client";

import { useState, useEffect, useCallback } from "react";

interface SlotData {
  id: string;
  date: string;
  startTime: string;
  capacity: number;
  remainingCapacity: number;
  lockoutOverride: boolean;
  lockedOut: boolean;
}

interface BookingData {
  id: string;
  slotId: string;
  traineeId: string;
  traineeName?: string;
  status: string;
}

interface TraineeInfo {
  id: string;
  name: string;
  phone: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

function getWeekDates(): { label: string; date: string }[] {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const date = d.toISOString().split("T")[0];
    const label = `${DAY_NAMES[i]} ${d.getDate()}/${d.getMonth() + 1}`;
    return { label, date };
  });
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [days] = useState(getWeekDates);
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [trainees, setTrainees] = useState<TraineeInfo[]>([]);
  const [error, setError] = useState("");
  const [addingSlotId, setAddingSlotId] = useState<string | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user || data.user.role !== "admin") {
          window.location.href = "/login";
          return;
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchSlots = useCallback(() => {
    return fetch(`/api/slots?date=${days[selectedDay].date}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []));
  }, [days, selectedDay]);

  const fetchBookings = useCallback(() => {
    return fetch("/api/admin/bookings")
      .then((r) => r.json())
      .then((data) => setBookings(data.bookings || []));
  }, []);

  const fetchTrainees = useCallback(() => {
    return fetch("/api/admin/trainees")
      .then((r) => r.json())
      .then((data) => setTrainees(data.trainees || []))
      .catch(() => {}); // endpoint may not exist yet
  }, []);

  useEffect(() => {
    if (loading) return;
    fetchSlots();
    fetchBookings();
    fetchTrainees();
  }, [loading, selectedDay, fetchSlots, fetchBookings, fetchTrainees]);

  async function handleAddTrainee(slotId: string) {
    if (!selectedTrainee) return;
    setError("");
    const trainee = trainees.find((t) => t.id === selectedTrainee);
    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        traineeId: selectedTrainee,
        slotId,
        traineeName: trainee?.name,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add");
      return;
    }
    setAddingSlotId(null);
    setSelectedTrainee("");
    fetchSlots();
    fetchBookings();
  }

  async function handleSlotOverride(
    slotId: string,
    date: string,
    startTime: string,
    updates: { capacity?: number; lockoutOverride?: boolean }
  ) {
    setError("");
    const res = await fetch("/api/admin/slots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId, date, startTime, ...updates }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Override failed");
      return;
    }
    fetchSlots();
  }

  async function handleRemove(bookingId: string) {
    setError("");
    const res = await fetch("/api/admin/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to remove");
      return;
    }
    fetchSlots();
    fetchBookings();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  // Group bookings by slotId for display
  const bookingsBySlot = new Map<string, BookingData[]>();
  for (const b of bookings) {
    if (!bookingsBySlot.has(b.slotId)) bookingsBySlot.set(b.slotId, []);
    bookingsBySlot.get(b.slotId)!.push(b);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-bold text-black dark:text-white">
          Admin Dashboard
        </h1>
        <div className="flex gap-3">
          <a
            href="/admin/trainees"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Trainees
          </a>
          <a
            href="/admin/settings"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Settings
          </a>
          <a
            href="/api/auth/session"
            onClick={async (e) => {
              e.preventDefault();
              await fetch("/api/auth/session", { method: "DELETE" });
              window.location.href = "/login";
            }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Logout
          </a>
        </div>
      </header>

      {/* Day selector */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        {days.map((day, i) => (
          <button
            key={day.date}
            onClick={() => setSelectedDay(i)}
            className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              i === selectedDay
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="p-4">
        {slots.length === 0 ? (
          <p className="text-center text-zinc-500">No slots for this day.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {slots.map((slot) => {
              const slotBookings = bookingsBySlot.get(slot.id) || [];
              const isAdding = addingSlotId === slot.id;

              return (
                <div
                  key={slot.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-black dark:text-white">
                        {slot.startTime}
                      </p>
                      {slot.lockedOut && !slot.lockoutOverride && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Locked
                        </span>
                      )}
                      {slot.lockoutOverride && (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Lockout off
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">
                        {slot.remainingCapacity}/{slot.capacity}
                      </span>
                      <button
                        onClick={() =>
                          handleSlotOverride(slot.id, slot.date, slot.startTime, {
                            capacity: slot.capacity === 2 ? 3 : 2,
                          })
                        }
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                        title={`Set capacity to ${slot.capacity === 2 ? 3 : 2}`}
                      >
                        Cap {slot.capacity === 2 ? "→3" : "→2"}
                      </button>
                      <button
                        onClick={() =>
                          handleSlotOverride(slot.id, slot.date, slot.startTime, {
                            lockoutOverride: !slot.lockoutOverride,
                          })
                        }
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        {slot.lockoutOverride ? "Enable lockout" : "Disable lockout"}
                      </button>
                    </div>
                  </div>

                  {/* Booked trainees */}
                  {slotBookings.length > 0 && (
                    <div className="mb-2 flex flex-col gap-1">
                      {slotBookings.map((b) => {
                        const trainee = trainees.find(
                          (t) => t.id === b.traineeId
                        );
                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5 dark:bg-zinc-800"
                          >
                            <span className="text-sm text-black dark:text-white">
                              {trainee?.name || b.traineeId}
                            </span>
                            <button
                              onClick={() => handleRemove(b.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add trainee */}
                  {isAdding ? (
                    <div className="flex gap-2">
                      <select
                        value={selectedTrainee}
                        onChange={(e) => setSelectedTrainee(e.target.value)}
                        className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="">Select trainee...</option>
                        {trainees
                          .filter(
                            (t) =>
                              !slotBookings.some((b) => b.traineeId === t.id)
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => handleAddTrainee(slot.id)}
                        disabled={!selectedTrainee}
                        className="rounded-lg bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingSlotId(null);
                          setSelectedTrainee("");
                        }}
                        className="text-sm text-zinc-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    slot.remainingCapacity > 0 && (
                      <button
                        onClick={() => setAddingSlotId(slot.id)}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        + Add trainee
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
