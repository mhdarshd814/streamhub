"use client";

export default function LiveRedirectPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center max-w-md">
        <div className="text-6xl mb-5">🎥</div>

        <h1 className="text-3xl font-black mb-3">
          No Stream Selected
        </h1>

        <p className="text-gray-400 mb-6">
          Please open a stream from your dashboard.
        </p>

        <button
          onClick={() => {
            window.location.href = "/dashboard";
          }}
          className="bg-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-700"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}