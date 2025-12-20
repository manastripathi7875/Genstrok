// pages/login.tsx

import { useEffect } from "react";
import { useRouter } from "next/router";
import { BRAND } from "../lib/brand";

export default function LoginPage() {
  const router = useRouter();

  // Always send user to /auth
  useEffect(() => {
    router.replace("/auth");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#020616] text-slate-50">
      {/* background visuals */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-24 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] top-32 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-40 bottom-[-40px] h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.08)_0,_transparent_55%)]" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-10 pt-8 sm:px-6 lg:flex-row lg:items-center lg:gap-8">
        {/* Left: Brand identity */}
        <section className="mb-8 lg:mb-0 lg:w-1/2">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/80 ring-1 ring-slate-700/70 shadow-md shadow-black/40">
              <span className="text-lg font-bold tracking-tight">
                {BRAND.shortName || BRAND.name?.[0] || "G"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                {BRAND.name || "Genstrok"}
              </p>
              <p className="text-[11px] text-slate-400">
                Creator ownership home
              </p>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-50 mb-3">
            You are heading to your Genstrok account hub.
          </h1>

          <p className="text-sm text-slate-300 mb-4 max-w-xl">
            Login and signup happen in one unified screen so that you do not get
            lost between multiple forms. From there you can claim assets, track
            coins, manage your wallet and unlock missions.
          </p>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-[11px] sm:text-xs max-w-xl">
            <p className="font-semibold text-slate-50 mb-1">
              What happens next
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>You are redirected to the main Genstrok auth page.</li>
              <li>That page handles both login and account creation.</li>
              <li>
                If you used a referral link, rewards tracking starts
                automatically after you log in.
              </li>
            </ul>
          </div>
        </section>

        {/* Right: Redirect status card */}
        <section className="lg:w-1/2">
          <div className="rounded-3xl border border-slate-800/90 bg-slate-900/90 p-5 shadow-xl shadow-black/60 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Login redirect
                </p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-slate-50">
                  Taking you to the Genstrok gateway
                </p>
              </div>
              <a
                href="/"
                className="hidden sm:inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-[11px] font-medium text-slate-200 shadow-sm shadow-slate-900/40 backdrop-blur"
              >
                Back to drops
              </a>
            </div>

            {/* loader */}
            <div className="mt-3 mb-4 flex items-center gap-3">
              <div className="relative h-9 w-9">
                <div className="absolute inset-0 rounded-full border border-violet-500/40" />
                <div className="absolute inset-1 rounded-full border-t-2 border-violet-400 animate-spin" />
              </div>
              <div className="text-[11px] sm:text-xs text-slate-300">
                <p>Redirecting you to the main account page in a moment.</p>
                <p className="mt-1 text-slate-400">
                  This keeps all login and signup logic in one secure place.
                </p>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-400">
              If nothing happens in a few seconds, you can continue manually.
            </div>

            <a
              href="/auth"
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-violet-500 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-violet-400"
            >
              Open Genstrok auth page
            </a>
          </div>

          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
            <a
              href="/"
              className="inline-flex items-center gap-1 hover:text-slate-300 sm:hidden"
            >
              <span>←</span>
              <span>Back to drops</span>
            </a>
            <span className="ml-auto">
              Fast redirect. No data is stored on this screen.
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}