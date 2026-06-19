"use client";

export default function LiveRedirectPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
        <div className="mb-5 text-6xl">🎥</div>

        <h1 className="mb-3 text-3xl font-black">No Stream Selected</h1>

        <p className="mb-6 text-gray-400">
          Start a new live stream or open an existing stream.
        </p>

        <button
          onClick={() => {
            window.location.href = "/go-live";
          }}
          className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700"
        >
          Go Live
        </button>
      </div>
    </div>
  );
}
