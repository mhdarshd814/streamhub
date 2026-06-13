export default function Loading() {
  return (
    <div className="fixed inset-0 z-[99999] flex min-h-screen items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] bg-red-600 shadow-[0_0_60px_rgba(220,38,38,0.65)]">
          <div className="absolute inset-0 rounded-[2rem] bg-red-500/30 blur-xl" />

          <div className="relative ml-1 h-0 w-0 border-y-[22px] border-l-[34px] border-y-transparent border-l-white" />
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-tight">
          Stream<span className="text-red-600">Hub</span>
        </h1>

        <p className="mt-2 text-sm uppercase tracking-[0.35em] text-zinc-500">
          Live Platform
        </p>

        <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-red-600" />
        </div>

        <p className="mt-5 text-sm text-zinc-400">
          Connecting to StreamHub...
        </p>
      </div>
    </div>
  );
}