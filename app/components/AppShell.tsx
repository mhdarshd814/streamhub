"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

const IMMERSIVE_PREFIXES = [
  "/live/",
  "/watch/",
  "/incoming-call/",
  "/admin/broadcast/",
];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isImmersive = IMMERSIVE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  return (
    <>
      {!isImmersive && <Navbar />}

      <main
        className={
          isImmersive
            ? "app-shell min-h-screen bg-black"
            : "app-shell min-h-screen pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-[calc(env(safe-area-inset-top)+4rem)] md:pb-0"
        }
      >
        {children}
      </main>
    </>
  );
}