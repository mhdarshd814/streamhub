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
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.35em] text-red-500">LAUNCH PRICING</p>
          <h1 className="text-5xl font-black tracking-tighter">StreamHub Pricing</h1>
          <p className="mx-auto mt-4 max-w-2xl text-gray-400">Choose how you support creators or grow as a creator. Payments are not live yet. Pricing is shown for launch planning.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {viewerPlans.map((plan) => (
            <div
              key={plan.name}
              className={`premium-glass rounded-3xl p-8 ${plan.highlighted ? 'ring-2 ring-red-500 scale-105' : ''}`}
            >
              {plan.highlighted && <div className="text-red-400 text-xs font-black mb-4">MOST POPULAR</div>}
              <h3 className="font-black text-2xl">{plan.name}</h3>
              <div className="mt-4 text-5xl font-black">{plan.price}<span className="text-sm font-normal text-gray-400">/month</span></div>
              <p className="mt-6 text-sm text-gray-400">{plan.subtitle}</p>

              <ul className="mt-8 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm">
                    <span className="text-red-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button disabled className="mt-8 w-full py-4 rounded-2xl bg-gray-800 text-sm font-bold">Coming Soon</button>
            </div>
          ))}
        </div>

        <div className="premium-glass rounded-3xl p-12">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <p className="text-xs font-black text-red-400">FOR CREATORS</p>
              <h2 className="text-4xl font-black mt-2">{creatorPlan.name}</h2>
              <div className="mt-6 text-6xl font-black">{creatorPlan.price}<span className="text-xl font-normal text-gray-400">/month</span></div>
              <p className="mt-6 text-gray-400">{creatorPlan.subtitle}</p>
            </div>

            <div>
              <ul className="space-y-4">
                {creatorPlan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm">
                    <span className="text-red-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}