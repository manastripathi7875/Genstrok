import "../styles/globals.css";
import type { AppProps } from "next/app";
import Link from "next/link";
import { useRouter } from "next/router";
import { BRAND } from "../lib/brand";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = router.pathname;

  const [profileName, setProfileName] = useState<string | null>(null);

  // 🔹 Top profile icon ke liye current user ka naam/email
  useEffect(() => {
    async function loadProfileName() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        setProfileName(null);
        return;
      }

      const user = data.user;
      let name: string | null = null;

      // 1) creator_profiles.display_name
      const { data: pData, error: pErr } = await supabase
        .from("creator_profiles")
        .select("display_name")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();

      if (!pErr && pData?.display_name) {
        name = pData.display_name;
      } else if (user.email) {
        // 2) email fallback
        name = user.email;
      } else if (
        (user as any).user_metadata &&
        (user as any).user_metadata.full_name
      ) {
        // 3) metadata full_name fallback
        name = (user as any).user_metadata.full_name as string;
      } else {
        // 4) ultimate fallback
        name = "You";
      }

      setProfileName(name);
    }

    loadProfileName();
  }, []);

  const profileInitial = (profileName || BRAND.name)
    .charAt(0)
    .toUpperCase();

  const isActive = (href: string) => {
    if (href === "/") return path === "/";
    return path.startsWith(href);
  };

  // 🔹 Top profile icon click → public creator page
  const handleProfileClick = () => {
    if (profileName) {
      const slug = encodeURIComponent(profileName);
      router.push(`/creators/${slug}`);
    } else {
      // agar login nahi / naam nahi mila to studio pe bhej do
      router.push("/creator-dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* TOP BAR */}
        <header className="z-30 h-16 flex items-center justify-between 
          border-b border-slate-800/60 bg-slate-950/90 
          px-4 backdrop-blur-xl shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
           {/* LEFT – BRAND */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center 
              rounded-full bg-violet-600 text-base font-bold shadow-lg shadow-violet-600/30">
            G
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-wide">
              {BRAND.name}
            </div>
            <div className="text-[10px] text-slate-400">
              Creator ownership sandbox
            </div>
          </div>
        </div>
 {/* RIGHT – ICON BUTTONS */}
        <nav className="flex items-center gap-3 text-[11px]">
          <Link
            href="/notifications"
           className="flex h-10 w-10 items-center justify-center rounded-full
              border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800
              text-[20px] shadow-md shadow-black/30">
            🔔
          </Link>

          <Link
            href="/wallet-activity"
           className="flex h-10 w-10 items-center justify-center rounded-full
              border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800
              text-[20px] shadow-md shadow-black/30">
            ◎
          </Link>

          <Link
            href="/admin"
            className="flex h-10 w-10 items-center justify-center rounded-full
                border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800
                text-[22px] shadow-md shadow-black/30">
              🛠️

          </Link>

          {/* TOP PROFILE ICON → PUBLIC CREATOR PAGE */}
          <button
            onClick={handleProfileClick}
            className="flex h-10 w-10 items-center justify-center rounded-full
                border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800
                text-[14px] font-semibold text-slate-200 shadow-md shadow-black/30">
            {profileInitial}
          </button>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 pb-16 pt-1">{children}</main>

      {/* BOTTOM NAV BAR */}
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800/80 bg-slate-950/95 px-4 py-1.5 backdrop-blur">
        <nav className="mx-auto flex max-w-md items-center justify-between text-[11px]">
          <Link
            href="/"
            className={
              "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 " +
              (isActive("/") ? "text-violet-300" : "text-slate-400")
            }
          >
            <span className="text-lg">⌂</span>
            <span>Home</span>
          </Link>

          <Link
            href="/wallet"
            className={
              "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 " +
              (isActive("/wallet") ? "text-violet-300" : "text-slate-400")
            }
          >
            <span className="text-lg">◎</span>
            <span>work</span>
          </Link>
 {/* BIG PLUS IN THE MIDDLE */}
    <a
      href="/create-drop"
      className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-violet-500 text-lg font-bold text-slate-950 shadow-lg shadow-violet-700/60"
    >
      +
    </a>
          {/* creators tab → creator dashboard / studio */}
          <Link
            href="/creator-dashboard"
            className={
              "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 " +
              (isActive("/creators")
                ? "text-violet-300"
                : "text-slate-400")
            }
          >
            <span className="text-lg">👤</span>
            <span>Creators</span>
          </Link>

          <Link
            href="/leaderboard"
            className={
              "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 " +
              (isActive("/leaderboard")
                ? "text-violet-300"
                : "text-slate-400")
            }
          >
            <span className="text-lg">🏆</span>
            <span>Top</span>
          </Link>
        </nav>
      </footer>
    </div>
  );
}

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}