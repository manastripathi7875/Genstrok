// pages/auth.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // if already logged in — redirect out
  useEffect(() => {
    let mounted = true;
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (data?.user && typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
    check();
    return () => {
      mounted = false;
    };
  }, []);

  // small helper to show messages
  function showMessage(text: string, timeout = 3500) {
    setMsg(text);
    setTimeout(() => setMsg(null), timeout);
  }

  // handle login or signup submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMsg(error.message || "Login failed");
        } else {
          // login successful — session is stored by supabase client
          showMessage("Logged in. Redirecting…", 1200);
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }
      } else {
        // signup
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMsg(error.message || "Sign up failed");
          return;
        }

        // handle referral credit if code provided
        // if signUp returned a user (session) -> immediate credit
        // if signUp requires email confirmation, still attempt to link the referral by inserting referral_uses row server-side later.
        const userId = data?.user?.id ?? null;

        if (refCode && refCode.trim().length > 0) {
          try {
            // find referrer by code
            const { data: refRow, error: refErr } = await supabase
              .from("referrals")
              .select("referrer_id")
              .eq("code", refCode.trim())
              .maybeSingle();

            if (refErr) {
              // non-fatal: show message but continue
              console.error("Referral lookup error", refErr);
              showMessage("Signup OK — referral lookup failed (debug).");
            } else if (!refRow) {
              showMessage("Signup OK — referral code not found.");
            } else if (userId) {
              // we have the newly created user id, call server RPC to credit referrer
              // rupees/coins set here — change values as required
              const { error: rpcErr } = await supabase.rpc(
                "credit_referrer_on_signup",
                {
                  referrer: refRow.referrer_id,
                  referred: userId,
                  rupees: 10,
                  coins: 20,
                }
              );

              if (rpcErr) {
                console.error("RPC credit_referrer_on_signup error", rpcErr);
                showMessage("Signup OK — referral credit failed.");
              } else {
                showMessage("Account created — referral reward applied.");
              }
            } else {
              // No immediate user session (email confirm required). Insert a pending referral_uses row so admin or backend can finish credit later.
              // Try to create a pending row with referred_id = NULL? Better approach: store referral in a pending table OR send to server.
              // For now, insert into referrals_pending with ref code and email for later processing (create table referrals_pending if needed).
              try {
                await supabase.from("referrals_pending").insert({
                  code: refCode.trim(),
                  referred_email: email,
                  created_at: new Date().toISOString(),
                });
                showMessage("Signup created. Referral recorded for verification.");
              } catch (pendErr) {
                // If table doesn't exist, skip silently
                console.warn("referrals_pending insert skipped", pendErr);
                showMessage("Signup OK — please verify email. Referral may be applied later.");
              }
            }
          } catch (ex) {
            console.error("Referral handling exception", ex);
            showMessage("Account created — referral handling error (debug).");
          }
        } else {
          // no referral code — simple success path
          if (userId) {
            showMessage("Account created. You are logged in — redirecting…", 1200);
            if (typeof window !== "undefined") {
              window.location.href = "/";
            }
          } else {
            showMessage(
              "Account created. Check your email to confirm and then log in."
            );
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-16 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -right-24 bottom-[-60px] h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 pb-10 pt-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/80 ring-1 ring-slate-700/60">
              <span className="text-xl font-bold tracking-tight">{BRAND.shortName || BRAND.name?.[0] || "G"}</span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">{BRAND.name} account</div>
              <div className="text-[11px] text-slate-400">Log in or sign up to claim drops & earn {BRAND.coinName}.</div>
            </div>
          </div>

          <a
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm shadow-slate-900/40 backdrop-blur"
          >
            Back to market
          </a>
        </header>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/70">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-50">{mode === "login" ? "Welcome back" : "Create your Genstrok account"}</h1>
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMsg(null);
              }}
              className="text-[11px] text-violet-300 underline"
              type="button"
            >
              {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@email.com"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-300">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Minimum 6 characters"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                required
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="mb-1 block text-[11px] text-slate-300">Referral code (optional)</label>
                <input
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  type="text"
                  placeholder="Enter a referral code (if you have one)"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Someone referred you? Add their code here and they may receive a reward.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12px] text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded bg-slate-800 checked:bg-violet-500"
                />
                Remember me
              </label>

              {mode === "login" && (
                <a href="/forgot" className="text-[11px] text-violet-300 underline">Forgot password?</a>
              )}
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? (mode === "login" ? "Logging in…" : "Creating account…") : (mode === "login" ? "Log in" : "Sign up")}
            </button>
          </form>

          {msg && <p className="mt-3 text-[12px] text-slate-300">{msg}</p>}

          <div className="mt-4 text-[11px] text-slate-400">
            <strong>Why sign up?</strong> Earn {BRAND.coinName} by claiming creator assets, join the drops economy, and unlock daily micro-earnings.
          </div>
        </section>
      </main>
    </div>
  );
}