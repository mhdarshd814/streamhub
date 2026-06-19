export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-black">Privacy Policy</h1>
          <p className="mt-4 text-gray-400">Effective Date: 18 June 2026</p>
        </div>

        <div className="premium-glass rounded-3xl p-10 space-y-10 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-black mb-4">Information We Collect</h2>
            <p>
              We collect your email address, username, display name, profile photo, bio, live stream content, chat messages, followers, likes, call activity, notification preferences, and payment records where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4">Camera and Microphone</h2>
            <p>
              StreamHub uses your camera and microphone only when you start or join a live stream, video call, or guest session. We do not access your camera or microphone without your explicit permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4">How We Use Data</h2>
            <p>
              We use your data to provide login, profiles, live streaming, chat, private calls, notifications, moderation, creator analytics, wallet features, and platform security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4">User Content</h2>
            <p>
              Content you share, including live streams, chat messages, profile details, and uploaded images, may be visible to other users depending on your privacy and stream settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4">Data Sharing</h2>
            <p>
              We do not sell your personal data. We may share data with service providers required to operate the app, such as authentication, database, storage, live streaming, hosting, push notifications, and payment services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4">Account Deletion</h2>
            <p>
              You may request account deletion at any time from the Delete Account page. When your request is processed, your profile and related user data will be removed or anonymized where required by law and platform security needs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4">Contact</h2>
            <p>
              For privacy or account deletion requests, contact:{" "}
              <span className="font-bold text-red-400">mymindovermaterz@gmail.com</span>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}