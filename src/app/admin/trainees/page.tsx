"use client";

import { useState, useEffect, useCallback } from "react";

interface Trainee {
  id: string;
  name: string;
  phone: string;
  isRecurring: boolean;
  preferredDay: number | null;
  preferredTime: string | null;
  isActive: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

export default function AdminTraineesPage() {
  const [loading, setLoading] = useState(true);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const fetchTrainees = useCallback(() => {
    fetch("/api/admin/trainees")
      .then((r) => r.json())
      .then((data) => setTrainees(data.trainees || []));
  }, []);

  useEffect(() => {
    if (!loading) fetchTrainees();
  }, [loading, fetchTrainees]);

  async function handleInvite() {
    setError("");
    const res = await fetch("/api/admin/trainees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: invitePhone, name: inviteName }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Invite failed");
      return;
    }
    setShowInvite(false);
    setInvitePhone("");
    setInviteName("");
    fetchTrainees();
  }

  async function handleUpdate(id: string, updates: Record<string, unknown>) {
    setError("");
    const res = await fetch("/api/admin/trainees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Update failed");
      return;
    }
    fetchTrainees();
  }

  const filtered = trainees.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.phone.includes(search)
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-bold text-black dark:text-white">
          Manage Trainees
        </h1>
        <a
          href="/admin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Back to Dashboard
        </a>
      </header>

      <div className="p-4">
        {/* Search + Invite */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <button
            onClick={() => setShowInvite(true)}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Invite
          </button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="mb-2 font-medium text-black dark:text-white">
              Invite New Trainee
            </h3>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <input
                type="tel"
                placeholder="Phone (+972...)"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleInvite}
                  disabled={!inviteName || !invitePhone}
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
                >
                  Send Invite
                </button>
                <button
                  onClick={() => setShowInvite(false)}
                  className="text-sm text-zinc-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Trainee list */}
        <div className="flex flex-col gap-2">
          {filtered.map((t) => {
            const isEditing = editingId === t.id;
            return (
              <div
                key={t.id}
                className={`rounded-xl border bg-white p-4 dark:bg-zinc-900 ${
                  t.isActive
                    ? "border-zinc-200 dark:border-zinc-700"
                    : "border-red-200 opacity-60 dark:border-red-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-black dark:text-white">
                      {t.name}
                    </p>
                    <p className="text-sm text-zinc-500">{t.phone}</p>
                    {t.isRecurring && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Recurring: {t.preferredDay !== null ? DAY_NAMES[t.preferredDay] : "?"}{" "}
                        {t.preferredTime || "?"}
                      </p>
                    )}
                    {!t.isActive && (
                      <p className="text-xs text-red-500">Deactivated</p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingId(isEditing ? null : t.id)}
                    className="text-sm text-zinc-500 hover:text-zinc-700"
                  >
                    {isEditing ? "Close" : "Edit"}
                  </button>
                </div>

                {isEditing && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <button
                      onClick={() =>
                        handleUpdate(t.id, { isRecurring: !t.isRecurring })
                      }
                      className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs dark:bg-zinc-800 dark:text-white"
                    >
                      {t.isRecurring ? "Unset recurring" : "Set recurring"}
                    </button>
                    {t.isRecurring && (
                      <>
                        <select
                          value={t.preferredDay ?? ""}
                          onChange={(e) =>
                            handleUpdate(t.id, {
                              preferredDay:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        >
                          <option value="">Day...</option>
                          {DAY_NAMES.map((d, i) => (
                            <option key={i} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={t.preferredTime || ""}
                          onChange={(e) =>
                            handleUpdate(t.id, {
                              preferredTime: e.target.value || null,
                            })
                          }
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                      </>
                    )}
                    <button
                      onClick={() =>
                        handleUpdate(t.id, { isActive: !t.isActive })
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs ${
                        t.isActive
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}
                    >
                      {t.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
