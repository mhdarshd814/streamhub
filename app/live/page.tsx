"use client";

export default function LiveRedirectPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="premium-glass max-w-md rounded-3xl p-12 text-center shadow-2xl">
        <div className="mx-auto mb-8 w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center text-5xl">🎥</div>

        <h1 className="mb-4 text-4xl font-black">No Stream Selected</h1>

        <p className="mb-8 text-gray-400">
          Start a new live stream or open an existing one.
        </p>

        <button
          onClick={() => {
            window.location.href = "/go-live";
          }}
          className="w-full py-5 rounded-2xl bg-red-600 text-xl font-black hover:bg-red-500"
        >
          Go Live Now
        </button>
      </div>
    </main>
  );
}