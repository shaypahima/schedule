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
  // Find next Sunday (or today if Sunday)
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
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check auth
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
        else window.location.href = "/login";
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch bookings
  const fetchBookings = useCallback(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => setMyBookings(data.bookings || []));
  }, []);

  // Fetch slots for selected day
  useEffect(() => {
    if (!user) return;
    setSlotsLoading(true);
    setError("");
    fetch(`/api/slots?date=${days[selectedDay].date}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []))
      .catch(() => setError("Failed to load slots"))
      .finally(() => setSlotsLoading(false));
    fetchBookings();
  }, [user, selectedDay, days, fetchBookings]);

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
    // Refresh
    fetchBookings();
    const slotsRes = await fetch(`/api/slots?date=${days[selectedDay].date}`);
    const slotsData = await slotsRes.json();
    setSlots(slotsData.slots || []);
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
    const slotsRes = await fetch(`/api/slots?date=${days[selectedDay].date}`);
    const slotsData = await slotsRes.json();
    setSlots(slotsData.slots || []);
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
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

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Slots */}
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
              const myBooking = myBookings.find(
                (b) => b.slotId === slot.id
              );

              return (
                <div
                  key={slot.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    isBooked
                      ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
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
                    <button
                      onClick={() => myBooking && handleCancel(myBooking.id)}
                      className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                    >
                      Cancel
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
