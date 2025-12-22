// pages/auth.tsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type Mode = "login" | "signup" | "phone";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toast(text: string, t = 4500) {
    setMsg(text);
    setTimeout(() => setMsg(null), t);
  }

  /* ================= EMAIL LOGIN / SIGNUP ================= */
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast("Account not found. Create one to continue.");
          setMode("signup");
          return;
        }

        toast("Welcome back 👋");
        setTimeout(() => (window.location.href = "/"), 700);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast(error.message);
        return;
      }

      if (refCode && data?.user?.id) {
        try {
          const { data: ref } = await supabase
            .from("referrals")
            .select("referrer_id")
            .eq("code", refCode)
            .maybeSingle();

          if (ref?.referrer_id) {
            await supabase.rpc("credit_referrer_on_signup", {
              referrer: ref.referrer_id,
              referred: data.user.id,
              rupees: 10,
              coins: 20,
            });
          }
        } catch {}
      }

      toast("Verify your email to continue 🚀", 6000);
    } finally {
      setLoading(false);
    }
  }

  /* ================= GOOGLE ================= */
  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  /* ================= PHONE ================= */
  async function sendOtp() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true },
    });

    if (error) toast(error.message);
    else {
      setOtpSent(true);
      toast("OTP sent");
    }
    setLoading(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (error) toast(error.message);
    else {
      toast("Verified 🎉");
      setTimeout(() => (window.location.href = "/"), 700);
    }
    setLoading(false);
  }

  return (
  <div className="min-h-screen w-full bg-[#06070F] flex items-center justify-center px-4 relative overflow-hidden">
    {/* BACKGROUND */}
    <div className="absolute inset-0">
      <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-purple-700/25 blur-[120px]" />
      <div className="absolute bottom-[-200px] right-[-200px] h-[500px] w-[500px] rounded-full bg-fuchsia-600/25 blur-[120px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black/90" />
    </div>

    {/* AUTH CARD */}
    <div className="relative z-10 w-full max-w-sm rounded-[28px] border border-white/15 bg-[#0B0E1A]/90 shadow-[0_30px_80px_rgba(0,0,0,0.9)] backdrop-blur-xl px-6 py-7">

      {/* LOGO */}
      <div className="flex justify-center mb-5">
        <div className="h-14 w-14 rounded-2xl bg-black/60 flex items-center justify-center text-xl font-bold border border-white/10">
          {BRAND.shortName || "G"}
        </div>
      </div>

      {/* TITLE */}
      <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
        {mode === "login" ? "Welcome Back" : "Get Started Free"}
      </h1>
      <p className="mt-1 text-center text-sm text-slate-400">
        {mode === "login" ? "We missed you" : "No credit card required"}
      </p>

      {/* FORM */}
      <div className="mt-6 space-y-3">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        {mode === "signup" && (
          <input
            type="text"
            placeholder="Referral code (optional)"
            value={refCode}
            onChange={(e) => setRefCode(e.target.value)}
            className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500"
          />
        )}

        {/* CTA */}
        <button
          disabled={loading}
          onClick={handleEmail}
          className="mt-2 w-full rounded-xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(168,85,247,0.6)] hover:opacity-95 transition"
        >
          {mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </div>

      {/* DIVIDER */}
      <div className="my-5 flex items-center gap-2 text-xs text-slate-500">
        <div className="h-px flex-1 bg-white/10" />
        or continue with
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* OAUTH */}
      <div className="space-y-2">
        <button
          onClick={google}
          className="w-full rounded-xl border border-white/15 bg-black/40 py-3 text-sm text-white hover:bg-black/60 transition"
        >
          Continue with Google
        </button>

        <button
          onClick={() => setMode("phone")}
          className="w-full rounded-xl border border-white/15 bg-black/40 py-3 text-sm text-white hover:bg-black/60 transition"
        >
          Continue with Phone
        </button>
      </div>

      {/* FOOTER */}
      <div className="mt-6 text-center text-sm text-slate-400">
        {mode === "login" ? (
          <>
            Don’t have an account?{" "}
            <button
              onClick={() => setMode("signup")}
              className="text-purple-400 underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              onClick={() => setMode("login")}
              className="text-purple-400 underline"
            >
              Sign in
            </button>
          </>
        )}
      </div>

      {msg && (
        <p className="mt-4 text-center text-xs text-slate-300">{msg}</p>
      )}
    </div>
  </div>
);
} 