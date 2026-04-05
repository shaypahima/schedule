"use client";

import { useState, useEffect, useCallback } from "react";

interface SlotData {
  id: string;
  date: string;
  startTime: string;
  capacity: number;
  currentBookings: number;
  remainingCapacity: number;
}

interface BookingData {
  id: string;
  slotId: string;
  status: string;
}

interface UserSession {
  id: string;
  name: string;
  role: string;
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

export default function BookPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [days] = useState(getWeekDates);
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [myBookings, setMyBookings] = useState<BookingData[]>([]);
  const [remainingEdits, setRemainingEdits] = useState(3);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
        else window.location.href = "/login";
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchBookings = useCallback(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => {
        setMyBookings(data.bookings || []);
        if (data.remainingEdits !== undefined) {
          setRemainingEdits(data.remainingEdits);
        }
      });
  }, []);

  const refreshSlots = useCallback(() => {
    return fetch(`/api/slots?date=${days[selectedDay].date}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []));
  }, [days, selectedDay]);

  useEffect(() => {
    if (!user) return;
    setSlotsLoading(true);
    setError("");
    refreshSlots()
      .catch(() => setError("Failed to load slots"))
      .finally(() => setSlotsLoading(false));
    fetchBookings();
  }, [user, selectedDay, days, fetchBookings, refreshSlots]);

  async function handleBook(slotId: string) {
    setError("");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Booking failed");
      return;
    }
    fetchBookings();
    refreshSlots();
  }

  async function handleCancel(bookingId: string) {
    setError("");
    const res = await fetch("/api/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Cancel failed");
      return;
    }
    fetchBookings();
    refreshSlots();
  }

  async function handleReschedule(newSlotId: string) {
    if (!rescheduleBookingId) return;
    setError("");
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: rescheduleBookingId, newSlotId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Reschedule failed");
      return;
    }
    setRescheduleBookingId(null);
    fetchBookings();
    refreshSlots();
  }

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  const bookedSlotIds = new Set(myBookings.map((b) => b.slotId));
  const editsLow = remainingEdits <= 1;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-bold text-black dark:text-white">
          Book a Session
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Remaining edits banner */}
      <div
        className={`border-b px-4 py-2 text-sm ${
          editsLow
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
            : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
        }`}
      >
        {remainingEdits > 0
          ? `${remainingEdits} edit${remainingEdits !== 1 ? "s" : ""} remaining this week`
          : "No edits remaining this week"}
      </div>

      {/* Reschedule mode banner */}
      {rescheduleBookingId && (
        <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
          <span>Select a new slot to reschedule into</span>
          <button
            onClick={() => setRescheduleBookingId(null)}
            className="font-medium underline"
          >
            Cancel
          </button>
        </div>
      )}

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
        {slotsLoading ? (
          <p className="text-center text-zinc-500">Loading slots...</p>
        ) : slots.length === 0 ? (
          <p className="text-center text-zinc-500">
            No available slots for this day.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.map((slot) => {
              const isBooked = bookedSlotIds.has(slot.id);
              const myBooking = myBookings.find((b) => b.slotId === slot.id);
              const isRescheduleTarget = rescheduleBookingId && !isBooked;

              return (
                <div
                  key={slot.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    isBooked
                      ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                      : isRescheduleTarget
                        ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                >
                  <div>
                    <p className="font-medium text-black dark:text-white">
                      {slot.startTime}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {isBooked
                        ? "Your session"
                        : `${slot.remainingCapacity} spot${slot.remainingCapacity !== 1 ? "s" : ""} left`}
                    </p>
                  </div>
                  {isBooked ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          myBooking && setRescheduleBookingId(myBooking.id)
                        }
                        disabled={remainingEdits <= 0}
                        className="rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200 disabled:opacity-40 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => myBooking && handleCancel(myBooking.id)}
                        disabled={remainingEdits <= 0}
                        className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-40 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : isRescheduleTarget ? (
                    <button
                      onClick={() => handleReschedule(slot.id)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      Move here
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBook(slot.id)}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      Book
                    </button>
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
