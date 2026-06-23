export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-cyan-400">
          Community Guidelines
        </p>

        <h1 className="mb-6 text-3xl font-black md:text-5xl">
          StreamHub Community Guidelines
        </h1>

        <div className="space-y-6 text-base leading-8 text-gray-300">
          <p>
            StreamHub is built for live interaction, creativity, private calls,
            and creator communities. Every user is responsible for keeping the
            platform safe, respectful, and legal.
          </p>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">Not Allowed</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Harassment, bullying, threats, or targeted abuse.</li>
              <li>Hate speech, discrimination, or violent extremist content.</li>
              <li>Nudity, sexual content, or sexually exploitative behavior.</li>
              <li>Illegal activity, scams, fraud, or dangerous behavior.</li>
              <li>Impersonation of another person, creator, brand, or company.</li>
              <li>Spam, fake engagement, misleading links, or platform abuse.</li>
              <li>Copyright infringement or unauthorized rebroadcasting.</li>
              <li>Sharing private personal information without consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">Live Streams and Calls</h2>
            <p>
              Live streams and private calls must follow these guidelines at all
              times. StreamHub may remove content, restrict access, suspend
              accounts, or permanently ban users who misuse live features.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">Moderation Actions</h2>
            <p>
              Depending on the violation, StreamHub may issue warnings, mute
              accounts, remove content, block users from streams, suspend
              features, or permanently ban accounts.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">Reporting</h2>
            <p>
              Users should report abusive, illegal, harmful, or suspicious
              activity using the reporting and moderation tools available on the
              platform.
            </p>
          </section>

          <p>
            For safety concerns or abuse reports, contact:
            <span className="ml-1 font-bold text-white">ashikhan46@yahoo.com</span>
          </p>
        </div>
      </section>
    </main>
  );
}
