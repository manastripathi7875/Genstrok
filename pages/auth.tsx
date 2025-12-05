import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
      }
    }
    checkUser();
  }, []);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setMsg(mode === "login" ? "Logging in..." : "Creating account...");

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMsg("Error: " + error.message);
      } else {
        setMsg("Logged in as " + (data.user?.email || ""));
        setUser(data.user);
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setMsg("Error: " + error.message);
      } else {
        setMsg(
          "Account created. Check your email (if confirmation is enabled) and then log in."
        );
        setUser(data.user ?? null);
      }
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setMsg("Logged out");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-16 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -right-24 bottom-[-60px] h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 pb-10 pt-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/80 ring-1 ring-slate-700/60">
              <span className="text-lg font-bold tracking-tight">P</span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Protera Account
              </div>
              <div className="text-[11px] text-slate-400">
                Sign in to claim & earn coins
              </div>
            </div>
          </div>
          <a
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm shadow-slate-900/40 backdrop-blur"
          >
            Back to store
          </a>
        </header>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/70 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-base font-semibold text-slate-50">
              {mode === "login" ? "Log in" : "Create your account"}
            </h1>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-[11px] text-violet-300 underline"
            >
              {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
            </button>
          </div>

          {user && (
            <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
              Logged in as <span className="font-semibold">{user.email}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@email.com"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Minimum 6 characters"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                required
              />
            </div>

            <button className="mt-2 w-full rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-violet-400">
              {mode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>

          {msg && (
            <p className="mt-3 text-[11px] text-slate-300">
              {msg}
            </p>
          )}

          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900"
            >
              Log out
            </button>
          )}
        </section>
      </main>
    </div>
  );
}