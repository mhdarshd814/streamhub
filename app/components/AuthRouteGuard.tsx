"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const PROTECTED_PREFIXES = [
  "/live-feed",
  "/dashboard",
  "/go-live",
  "/calls",
  "/wallet",
  "/profile",
  "/profile/edit",
  "/notifications",
  "/invites",
  "/schedule",
  "/streams/upcoming",
  "/admin",
  "/live",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <section className="slide-up w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl shadow-2xl shadow-red-600/30 premium-glow">
          <img
            src="/icon-512.png"
            alt="StreamHub"
            className="h-full w-full object-cover"
          />
        </div>

        <h1 className="text-5xl font-black tracking-tight">
          <span className="text-white">Stream</span>
          <span className="text-red-500">Hub</span>
        </h1>

        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
          Checking Session
        </p>

        <div className="mx-auto mt-7 h-1.5 w-44 overflow-hidden rounded-full bg-gray-800">
          <div className="opening-bar h-full w-1/2 rounded-full bg-red-600" />
        </div>
      </section>
    </main>
  );
}

export default function AuthRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const protectedRoute = useMemo(() => isProtectedPath(pathname), [pathname]);

  const [checking, setChecking] = useState(protectedRoute);
  const [allowed, setAllowed] = useState(!protectedRoute);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (!protectedRoute) {
        setChecking(false);
        setAllowed(true);
        return;
      }

      setChecking(true);
      setAllowed(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user || !session.access_token) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!protectedRoute) return;

      if (!session?.user || !session.access_token) {
        setAllowed(false);
        setChecking(false);
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setAllowed(true);
      setChecking(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, protectedRoute, router]);

  if (protectedRoute && (checking || !allowed)) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
