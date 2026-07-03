"use client";

import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "short" | "checking" | "available" | "taken">("idle");
  const [passwordStrength, setPasswordStrength] = useState<"idle" | "weak" | "medium" | "strong">("idle");

  function evaluatePasswordStrength(value: string): "idle" | "weak" | "medium" | "strong" {
    if (!value) return "idle";

    let score = 0;
    let hasLower = false;
    let hasUpper = false;
    let hasNumber = false;
    let hasSymbol = false;

    for (const char of value) {
      if (char >= "a" && char <= "z") hasLower = true;
      else if (char >= "A" && char <= "Z") hasUpper = true;
      else if (char >= "0" && char <= "9") hasNumber = true;
      else hasSymbol = true;
    }

    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (hasLower && hasUpper) score++;
    if (hasNumber) score++;
    if (hasSymbol) score++;

    if (score <= 2) return "weak";
    if (score <= 4) return "medium";
    return "strong";
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordStrength(evaluatePasswordStrength(value));
  };

  function cleanUsername(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
  }

  useEffect(() => {
    const safeUsername = cleanUsername(username);

    if (!safeUsername) {
      setUsernameStatus("idle");
      return;
    }

    if (safeUsername.length < 3) {
      setUsernameStatus("short");
      return;
    }

    let cancelled = false;
    setUsernameStatus("checking");

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", safeUsername)
        .maybeSingle();

      if (!cancelled) {
        setUsernameStatus(data ? "taken" : "available");
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  async function handleSignup() {
    const safeUsername = cleanUsername(username);
    const cleanEmail = email.trim();

    if (!safeUsername || !cleanEmail || !password) {
      toast.error("Please complete all fields.");
      return;
    }

    if (safeUsername.length < 3) {
      toast.error("Username must be at least 3 characters.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (usernameStatus === "taken") {
      toast.error("Username is already taken.");
      return;
    }

    if (usernameStatus === "checking") {
      toast.error("Please wait while we check the username.");
      return;
    }

    if (!acceptedPolicies) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }

    setLoading(true);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", safeUsername)
      .maybeSingle();

    if (existingProfile) {
      setLoading(false);
      toast.error("Username is already taken.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: safeUsername,
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Account created. Check your email to verify.");

    setTimeout(() => {
      window.location.href = "/login";
    }, 900);
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center bg-black px-5 py-4 text-white">
      <div className="slide-up w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl shadow-2xl shadow-red-600/30 premium-glow">
            <img
              src="/icon-512.png"
              alt="StreamHub"
              className="h-full w-full object-cover"
            />
          </div>

          <h1 className="text-4xl font-black">
            <span className="text-white">Stream</span>
            <span className="text-red-500">Hub</span>
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Create your account and build your live audience.
          </p>
        </div>

        <div className="premium-card rounded-3xl p-6">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
              Start streaming
            </p>
            <h2 className="mt-2 text-3xl font-black">Create Account</h2>
            <p className="mt-1 text-sm text-gray-400">
              Pick a clean username. Improve your profile after login.
            </p>
          </div>

          <div className="space-y-3.5">
            <input
              placeholder="Username"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(cleanUsername(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignup();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            {usernameStatus !== "idle" && (
              <p
                className={
                  usernameStatus === "available"
                    ? "text-xs font-bold text-green-400"
                    : usernameStatus === "taken"
                    ? "text-xs font-bold text-red-400"
                    : "text-xs font-bold text-gray-400"
                }
              >
                {usernameStatus === "short" && "Username must be at least 3 characters."}
                {usernameStatus === "checking" && "Checking username..."}
                {usernameStatus === "available" && "Username is available."}
                {usernameStatus === "taken" && "Username is already taken."}
              </p>
            )}

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignup();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => handlePasswordChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignup();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            {passwordStrength !== "idle" && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <div
                    className={
                      passwordStrength === "weak"
                        ? "h-1.5 flex-1 rounded-full bg-red-500"
                        : passwordStrength === "medium"
                        ? "h-1.5 flex-1 rounded-full bg-yellow-400"
                        : "h-1.5 flex-1 rounded-full bg-green-400"
                    }
                  />
                  <div
                    className={
                      passwordStrength === "medium"
                        ? "h-1.5 flex-1 rounded-full bg-yellow-400"
                        : passwordStrength === "strong"
                        ? "h-1.5 flex-1 rounded-full bg-green-400"
                        : "h-1.5 flex-1 rounded-full bg-gray-700"
                    }
                  />
                  <div
                    className={
                      passwordStrength === "strong"
                        ? "h-1.5 flex-1 rounded-full bg-green-400"
                        : "h-1.5 flex-1 rounded-full bg-gray-700"
                    }
                  />
                </div>
                <p
                  className={
                    passwordStrength === "weak"
                      ? "text-xs font-bold text-red-400"
                      : passwordStrength === "medium"
                      ? "text-xs font-bold text-yellow-400"
                      : "text-xs font-bold text-green-400"
                  }
                >
                  {passwordStrength === "weak" && "Weak password. Use 8+ characters with mixed case and numbers."}
                  {passwordStrength === "medium" && "Medium password. Add symbols or more length for better security."}
                  {passwordStrength === "strong" && "Strong password."}
                </p>
              </div>
            )}

            <label className="flex items-start gap-3 rounded-2xl border border-gray-800 bg-black/30 p-3.5 text-sm leading-6 text-gray-300">
              <input
                type="checkbox"
                checked={acceptedPolicies}
                onChange={(e) => setAcceptedPolicies(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 accent-red-600"
              />
              <span>
                I have read and agree to the{" "}
                <a href="/terms" className="font-bold text-red-400 underline hover:text-red-300">
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a href="/privacy" className="font-bold text-red-400 underline hover:text-red-300">
                  Privacy Policy
                </a>.
              </span>
            </label>

            <button
              type="button"
              onClick={handleSignup}
              disabled={loading || !acceptedPolicies}
              className="w-full rounded-xl bg-red-600 py-3.5 text-lg font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-700"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-800 bg-black/30 p-3.5 text-sm leading-6 text-gray-400">
            After signup, verify your email first. Then login and complete your
            profile so creators and viewers can recognize you.
          </div>

          <div className="mt-5 text-center">
            <p className="text-sm text-gray-400">Already have an account?</p>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/login";
              }}
              className="mt-1.5 font-black text-red-500 hover:text-red-400"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
