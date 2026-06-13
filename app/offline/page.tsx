import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl">
          📡
        </div>

        <h1 className="text-2xl font-bold">You are offline</h1>

        <p className="mt-3 text-sm leading-6 text-zinc-400">
          StreamHub needs an internet connection for live streams, private calls,
          chat, tips, subscriptions and notifications.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}