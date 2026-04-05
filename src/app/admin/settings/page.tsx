"use client";

import { useState, useEffect } from "react";

interface GoogleStatus {
  connected: boolean;
  mock: boolean;
}

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check auth
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user || data.user.role !== "admin") {
          window.location.href = "/login";
          return;
        }
        return fetch("/api/auth/google/status");
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data) setStatus(data);
      })
      .finally(() => setLoading(false));

    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setMessage("Google Calendar connected successfully!");
    } else if (params.get("error")) {
      setMessage(`Connection failed: ${params.get("error")}`);
    }
  }, []);

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
          Admin Settings
        </h1>
        <a
          href="/admin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Back to Dashboard
        </a>
      </header>

      <div className="p-4">
        {message && (
          <div
            className={`mb-4 rounded-lg px-4 py-2 text-sm ${
              message.includes("successfully")
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {message}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 font-semibold text-black dark:text-white">
            Google Calendar
          </h2>

          {status?.mock ? (
            <div className="text-sm text-zinc-500">
              <p className="mb-2">
                Running in <strong>mock mode</strong>. Google Calendar
                integration is simulated.
              </p>
              <p>Set MOCK_SERVICES=false and configure Google OAuth2 credentials to connect.</p>
            </div>
          ) : status?.connected ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Connected
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                Google Calendar is connected. Bookings will create calendar events.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  Not connected
                </span>
              </div>
              <a
                href="/api/auth/google"
                className="inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Connect Google Calendar
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
