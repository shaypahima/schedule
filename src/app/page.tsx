import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex flex-col items-center gap-8 p-8">
        <h1 className="text-4xl font-bold text-black dark:text-white">
          Coach Booking
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Book your training sessions
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-full bg-black px-6 py-3 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Login
          </Link>
        </div>
      </main>
    </div>
  );
}
