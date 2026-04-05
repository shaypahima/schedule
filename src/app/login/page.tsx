"use client";

import { useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error("Failed to send OTP");
      setStep("otp");
    } catch {
      setError("Failed to send OTP. Try again.");
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      if (!res.ok) throw new Error("Invalid OTP");
      const data = await res.json();
      // Redirect based on role
      window.location.href = data.role === "admin" ? "/admin" : "/book";
    } catch {
      setError("Invalid code. Try again.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-6 text-2xl font-bold text-center text-black dark:text-white">
          Login
        </h1>

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+972..."
              className="rounded-lg border border-zinc-300 px-4 py-3 text-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-black px-4 py-3 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Send Code
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Enter the code sent to {phone}
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="rounded-lg border border-zinc-300 px-4 py-3 text-center text-2xl tracking-widest text-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-black px-4 py-3 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Verify
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Change phone number
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
