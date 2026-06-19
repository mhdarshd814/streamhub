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
        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl premium-glow shadow-2xl shadow-red-600/40">
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

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
          Checking Access
        </p>

        <div className="mx-auto mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-zinc-900">
          <div className="loading-bar h-full w-1/2 bg-gradient-to-r from-red-500 to-red-600 rounded-full" />
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
      if (!protectedRoute || cancelled) return;

      if (!session?.user || !session.access_token) {
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