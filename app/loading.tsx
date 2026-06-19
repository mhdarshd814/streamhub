export default function Loading() {
  return (
    <div className="fixed inset-0 z-[99999] flex min-h-screen items-center justify-center bg-black text-white overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#450a0a_0%,transparent_70%)]" />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Logo Container */}
        <div className="relative mb-10 flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-0 rounded-[3rem] bg-red-600/20 blur-3xl animate-pulse" />
          
          <div className="relative flex h-28 w-28 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-red-600 via-red-700 to-black premium-glow">
            <img 
              src="/icon-512.png" 
              alt="StreamHub" 
              className="h-20 w-20 object-contain drop-shadow-2xl" 
            />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-6xl font-black tracking-[-2px] mb-2">
          Stream<span className="text-red-500">Hub</span>
        </h1>

        <p className="text-lg font-light text-gray-400 tracking-widest mb-12">
          THE CREATOR PLATFORM
        </p>

        {/* Loading Indicator */}
        <div className="relative w-56">
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
            <div className="loading-bar h-full w-1/2 bg-gradient-to-r from-red-500 via-red-400 to-red-600 rounded-full" />
          </div>
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono text-red-500/70 tracking-[3px]">
            CONNECTING
          </div>
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          Finding the best live experiences for you...
        </p>
      </div>

      {/* Subtle bottom branding */}
      <div className="absolute bottom-8 text-[10px] text-zinc-700 tracking-widest">
        POWERED BY CREATORS • FOR CREATORS
      </div>
    </div>
  );
}