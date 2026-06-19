"use client";

const viewerPlans = [
  {
    name: "Fan",
    price: "$1",
    subtitle: "For viewers who want to support creators.",
    features: ["Fan Badge", "Support Your Favorite Creator", "Priority Notifications"],
  },
  {
    name: "Premium",
    price: "$3",
    subtitle: "For viewers who want more creator access.",
    features: [
      "Everything in Fan",
      "Subscriber-Only Streams",
      "Premium Badge",
      "Future Exclusive Content Access",
    ],
    highlighted: true,
  },
  {
    name: "VIP",
    price: "$5",
    subtitle: "For top supporters who want recognition.",
    features: [
      "Everything in Premium",
      "VIP Badge",
      "Priority Chat Visibility",
      "Early Access Streams",
      "VIP Recognition",
    ],
  },
];

const creatorPlan = {
  name: "Creator Pro",
  price: "$10",
  subtitle: "For creators who want monetization tools.",
  features: [
    "Creator Badge",
    "Private Calls",
    "Subscriber-Only Streams",
    "Revenue Dashboard",
    "Advanced Analytics",
    "Creator Monetization Features",
  ],
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white sm:px-8 lg:px-12">
      <section className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.35em] text-red-500">
            Launch Pricing
          </p>

          <h1 className="text-4xl font-black sm:text-5xl lg:text-6xl">
            StreamHub Pricing
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-gray-400 sm:text-base">
            Choose how you support creators or grow as a creator. Payments are
            not live yet. Pricing is shown for launch planning and test mode.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-red-900/40 bg-red-600/10 px-4 py-2 text-xs font-black text-red-300">
            USD Pricing
          </span>
          <span className="rounded-full border border-gray-800 bg-gray-900 px-4 py-2 text-xs font-black text-gray-300">
            No Duration Limit
          </span>
          <span className="rounded-full border border-gray-800 bg-gray-900 px-4 py-2 text-xs font-black text-gray-300">
            Coming Soon
          </span>
        </div>

        <section className="mb-12">
          <div className="mb-5">
            <h2 className="text-2xl font-black sm:text-3xl">Viewer Plans</h2>
            <p className="mt-2 text-sm text-gray-400">
              Simple monthly plans for viewers who want to support creators and
              unlock future subscriber benefits.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {viewerPlans.map((plan) => (
              <div
                key={plan.name}
                className={
                  plan.highlighted
                    ? "relative rounded-3xl border border-red-600 bg-red-600/10 p-6 shadow-2xl shadow-red-950/30"
                    : "rounded-3xl border border-gray-800 bg-gray-950 p-6 shadow-2xl shadow-black/30"
                }
              >
                {plan.highlighted && (
                  <div className="absolute right-5 top-5 rounded-full bg-red-600 px-3 py-1 text-xs font-black">
                    Popular
                  </div>
                )}

                <h3 className="text-2xl font-black">{plan.name}</h3>

                <div className="mt-4 flex items-end gap-1">
                  <span className="text-5xl font-black">{plan.price}</span>
                  <span className="pb-2 text-sm font-bold text-gray-400">
                    /month
                  </span>
                </div>

                <p className="mt-4 min-h-[44px] text-sm leading-6 text-gray-400">
                  {plan.subtitle}
                </p>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-3 text-sm">
                      <span className="text-red-500">✓</span>
                      <span className="text-gray-200">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-7 w-full rounded-xl bg-gray-800 px-5 py-3 font-black text-gray-500"
                >
                  Coming Soon
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-red-900/40 bg-gradient-to-br from-red-600/15 via-gray-950 to-black p-6 shadow-2xl shadow-red-950/20 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-red-400">
                Creator Plan
              </p>

              <h2 className="text-3xl font-black sm:text-4xl">
                {creatorPlan.name}
              </h2>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-6xl font-black">{creatorPlan.price}</span>
                <span className="pb-2 text-sm font-bold text-gray-400">
                  /month
                </span>
              </div>

              <p className="mt-5 text-sm leading-6 text-gray-400">
                {creatorPlan.subtitle}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {creatorPlan.features.map((feature) => (
                <div
                  key={feature}
                  className="rounded-2xl border border-gray-800 bg-black/40 p-4 text-sm font-bold text-gray-200"
                >
                  <span className="mr-2 text-red-500">✓</span>
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
            Creator Pro features are planned for monetization rollout. Public
            streaming, profiles, followers and basic chat should remain free
            during launch to help StreamHub grow faster.
          </div>
        </section>
      </section>
    </main>
  );
}