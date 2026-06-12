"use client";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-7xl mx-auto px-6 py-28 text-center">
        <div className="inline-block mb-6 px-5 py-2 rounded-full bg-red-600/10 border border-red-600/30 text-red-400 font-semibold">
          Live Streaming Platform for Creators
        </div>

        <h1 className="text-7xl font-black mb-8 leading-tight">
          Go Live.
          <br />
          Build Your{" "}
          <span className="text-red-500">
            Audience.
          </span>
        </h1>

        <p className="text-gray-400 text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
          StreamHub helps creators broadcast live, chat with viewers,
          gain followers, collect likes, and build a real community
          around their content.
        </p>

        <div className="flex justify-center gap-5 mb-20">
          <button
            onClick={() => {
              window.location.href = "/explore";
            }}
            className="bg-red-600 px-9 py-4 rounded-xl text-lg font-bold hover:bg-red-700 shadow-lg shadow-red-600/25"
          >
            Watch Streams
          </button>

          <button
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="bg-gray-800 px-9 py-4 rounded-xl text-lg font-bold hover:bg-gray-700 border border-gray-700"
          >
            Creator Dashboard
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 text-left">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-red-600/50 transition">
            <div className="text-5xl mb-5">🎥</div>
            <h2 className="text-2xl font-bold mb-3">
              Live Streaming
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Broadcast instantly using your camera and microphone with
              real-time video powered by LiveKit.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-red-600/50 transition">
            <div className="text-5xl mb-5">💬</div>
            <h2 className="text-2xl font-bold mb-3">
              Real-Time Chat
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Talk with your audience while streaming and keep viewers
              engaged through instant chat.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-red-600/50 transition">
            <div className="text-5xl mb-5">🚀</div>
            <h2 className="text-2xl font-bold mb-3">
              Creator Growth
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Build your profile, gain followers, collect likes and
              grow your creator identity.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-4 gap-6">
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
            <h3 className="text-4xl font-black text-red-500">Live</h3>
            <p className="text-gray-400 mt-2">Real-time broadcast</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
            <h3 className="text-4xl font-black text-red-500">Chat</h3>
            <p className="text-gray-400 mt-2">Instant interaction</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
            <h3 className="text-4xl font-black text-red-500">Follow</h3>
            <p className="text-gray-400 mt-2">Build community</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
            <h3 className="text-4xl font-black text-red-500">Like</h3>
            <p className="text-gray-400 mt-2">Audience engagement</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-gray-500">
          © 2026 StreamHub. All Rights Reserved.
        </div>
      </footer>
    </main>
  );
}