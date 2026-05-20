export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex flex-col items-center gap-4 p-8 text-center">
        <h1 className="text-4xl font-bold text-black dark:text-white">Velofit</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Trainee + coach booking is on the mobile app.
        </p>
      </main>
    </div>
  );
}
