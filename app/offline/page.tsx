import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-md premium-glass rounded-3xl p-10 text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-600 text-5xl">
          📡
        </div>

        <h1 className="text-4xl font-black">You are offline</h1>

        <p className="mt-6 text-gray-400 leading-relaxed">
          StreamHub needs an internet connection for live streams, private calls, chat, tips, subscriptions and notifications.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-red-600 px-5 py-4 text-sm font-bold hover:bg-red-500"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}