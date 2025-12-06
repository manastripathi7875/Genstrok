import { useEffect } from "react";
import { BRAND } from "../lib/brand";

export default function LoginPage() {
  // ✅ Always send user to /auth
  // /auth already:
  //  - redirects logged-in users to "/"
  //  - shows login/signup form for others
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* soft background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-16 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -right-24 bottom-[-60px] h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 pb-10 pt-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/80 ring-1 ring-slate-700/60">
              <span className="text-lg font-bold tracking-tight">
                {BRAND.shortName || BRAND.name?.[0] || "G"}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                {BRAND.name} login
              </div>
              <div className="text-[11px] text-slate-400">
                We&apos;re sending you to the main auth page…
              </div>
            </div>
          </div>

          <a
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm shadow-slate-900/40 backdrop-blur"
          >
            Back to market
          </a>
        </header>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/70 backdrop-blur">
          <p className="text-[11px] text-slate-300">
            Redirecting you to the {BRAND.name} account page…
            <br />
            <span className="text-slate-400">
              If nothing happens,{" "}
              <a
                href="/auth"
                className="text-violet-300 underline"
              >
                tap here to continue.
              </a>
            </span>
          </p>
        </section>
      </main>
    </div>
  );
}