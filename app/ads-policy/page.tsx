export default function AdsPolicyPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-cyan-400">
          Ads Policy
        </p>

        <h1 className="mb-6 text-3xl font-black md:text-5xl">
          StreamHub Advertising Policy
        </h1>

        <div className="space-y-6 text-base leading-8 text-gray-300">
          <p>
            StreamHub may display advertisements to support platform operations,
            product development, hosting, safety systems, and creator-focused
            features.
          </p>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">Advertising Partners</h2>
            <p>
              StreamHub may work with third-party advertising partners, including
              Google AdSense and Google AdMob, to display ads on the website,
              Progressive Web App, or Android app.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">Cookies and Personalization</h2>
            <p>
              Advertising partners may use cookies, device identifiers, or similar
              technologies to show ads, measure performance, prevent fraud, and
              improve relevance. In regions where consent is required, users may
              be shown a consent message before personalized ads are used.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">Ad Placement</h2>
            <p>
              Ads may appear on selected non-sensitive pages such as feeds,
              dashboards, profiles, or informational pages. StreamHub does not
              intend to place disruptive ads inside active private calls,
              payment confirmation flows, or sensitive account actions.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">User Controls</h2>
            <p>
              Users may manage advertising consent where available through the
              consent message. Users may also control cookies and tracking
              settings through their browser, operating system, or Google ad
              settings.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-white">Policy Updates</h2>
            <p>
              This policy may be updated as StreamHub adds new advertising
              partners, app features, or compliance requirements.
            </p>
          </section>

          <p>
            For advertising or privacy questions, contact:
            <span className="ml-1 font-bold text-white">ashikhan46@yahoo.com</span>
          </p>
        </div>
      </section>
    </main>
  );
}
