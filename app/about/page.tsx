export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-cyan-400">
          About StreamHub
        </p>

        <h1 className="mb-6 text-3xl font-black md:text-5xl">
          A live streaming platform for creators, communities, and private calls.
        </h1>

        <div className="space-y-5 text-base leading-8 text-gray-300">
          <p>
            StreamHub is a live streaming platform designed for creators and users
            who want to connect through live video, real-time chat, private calls,
            guest streaming, and creator monetization tools.
          </p>

          <p>
            Users can discover live streams, follow creators, join scheduled
            events, send messages, and participate in private video calls when
            allowed by the creator.
          </p>

          <p>
            Creators can host public streams, subscriber-only streams, private
            calls, invite guests, review analytics, receive tips, manage wallets,
            and build their audience.
          </p>

          <p>
            StreamHub is built with safety, privacy, and community standards in
            mind. We provide moderation tools, reporting features, blocking,
            account deletion, and policy pages to support responsible use.
          </p>

          <p>
            For support or platform questions, contact us at:
            <span className="ml-1 font-bold text-white">ashikhan46@yahoo.com</span>
          </p>
        </div>
      </section>
    </main>
  );
}
