// pages/_app.tsx
import "../styles/globals.css";
import type { AppProps } from "next/app";
import Link from "next/link";
import { useRouter } from "next/router";
import { BRAND } from "../lib/brand";
import { ReactNode, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useBrandStory } from "../lib/useBrandStory";
import { BrandStoryModal } from "../components/BrandStoryModal";

function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = router.pathname;

  const [profileName, setProfileName] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  const { settings, hasUnread, markSeen } = useBrandStory();
  const logoUrl = settings?.logo_url || null;


  // load current user for top right profile initial + profile slug
  useEffect(() => {
    async function loadProfileName() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (user) {
          const meta: any = user.user_metadata || {};
          const rawEmail = user.email || "";
          const emailName = rawEmail.includes("@")
            ? rawEmail.split("@")[0]
            : rawEmail;

          const displayName =
            meta.full_name || meta.name || emailName || null;
          setProfileName(displayName);
        } else {
          setProfileName(null);
        }
      } catch (err) {
        console.error("Failed to load profile name", err);
        setProfileName(null);
      }
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

  const handleProfileClick = () => {
    if (profileName) {
      const slug = encodeURIComponent(profileName);
      router.push(`/creators/${slug}`);
    } else {
      router.push("/creator-dashboard");
    }
  };

  const hideBottomNav =
    path.startsWith("/auth") ||
    path.startsWith("/admin") ||
    path.startsWith("/api");

  // ---------- SCROLL HIDE/SHOW LOGIC FOR BOTTOM NAV ----------
  const [bottomHiddenByScroll, setBottomHiddenByScroll] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const THRESHOLD = 10; // minimum pixels movement to consider
  const MIN_SHOW_AT = 50; // don't hide when near top

  useEffect(() => {
    // if route already hides bottom nav, ensure visible state not used
    if (hideBottomNav) {
      setBottomHiddenByScroll(false);
      return;
    }

    lastScrollY.current = window.scrollY || 0;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY || 0;
        const delta = currentY - lastScrollY.current;

        // If user opens FAB, keep nav visible
        if (fabOpen) {
          setBottomHiddenByScroll(false);
          lastScrollY.current = currentY;
          ticking.current = false;
          return;
        }

        // if near top, always show
        if (currentY <= MIN_SHOW_AT) {
          setBottomHiddenByScroll(false);
        } else if (Math.abs(delta) > THRESHOLD) {
          if (delta > 0) {
            // scrolling down -> hide
            setBottomHiddenByScroll(true);
          } else {
            // scrolling up -> show
            setBottomHiddenByScroll(false);
          }
        }
        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [hideBottomNav, fabOpen]);

  // Ensure nav is visible when route requires hideBottomNav false -> handled in render

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col pb-24">
      {/* TOP BAR */}
      <header className="z-40 h-16 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/90 px-4 backdrop-blur">
        {/* left - logo with story ring */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (settings?.story_active) {
                setStoryOpen(true);
                markSeen();
              } else {
                router.push("/");
              }
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-900"
          >
            {settings?.story_active && (
              <span
                className={
                  "absolute inset-0 rounded-full border-[2.5px] " +
                  (hasUnread
                    ? "border-fuchsia-400 animate-pulse"
                    : "border-violet-500")
                }
              />
            )}

            <div className="relative h-8 w-8 rounded-full overflow-hidden bg-violet-600 flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={BRAND.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold">
                  {BRAND.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </button>

          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {BRAND.name}
            </span>
            <span className="text-sm font-medium text-slate-50">
              Creator ownership home
            </span>
          </div>
        </div>

        {/* right icons */}
        <nav className="flex items-center gap-3 text-[11px]">
          <Link
            href="/notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800 text-base shadow-md shadow-black/30"
          >
            <span role="img" aria-label="bell">
              🔔
            </span>
          </Link>

          <Link
            href="/wallet-activity"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800 text-base shadow-md shadow-black/30"
          >
            <span role="img" aria-label="wallet">
              💰
            </span>
          </Link>

          <Link
            href="/searchbar"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800 text-base shadow-md shadow-black/30"
          >
            <span role="img" aria-label="search">
              🔍
            </span>
          </Link>

          <button
            onClick={handleProfileClick}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold shadow-md shadow-black/30"
          >
            {profileInitial}
          </button>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1">{children}</main>

      {/* BOTTOM NAV + FAB */}
      {!hideBottomNav && (
        <footer
          aria-hidden={bottomHiddenByScroll}
          className={
            "fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/80 bg-slate-950/95 px-4 py-1.5 backdrop-blur transition-transform duration-300 ease-in-out " +
            (bottomHiddenByScroll
              ? "translate-y-full pointer-events-none"
              : "translate-y-0")
          }
        >
          <div className="relative mx-auto flex max-w-md items-center justify-between text-[11px]">
            {/* Home */}
            <Link
              href="/"
              className={
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 " +
                (isActive("/")
                  ? "text-violet-300"
                  : "text-slate-400 hover:text-slate-100")
              }
            >
              <span className="text-lg">⌂</span>
              <span>Home</span>
            </Link>

            {/* Wallet / Earn */}
            <Link
              href="/wallet"
              className={
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 " +
                (isActive("/wallet")
                  ? "text-violet-300"
                  : "text-slate-400 hover:text-slate-100")
              }
            >
              <span className="text-lg">💲</span>
              <span>Earn</span>
            </Link>

            {/* Spacer for FAB */}
            <div className="w-12" />

            {/* Creators */}
            <Link
              href="/creators"
              className={
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 " +
                (isActive("/creators")
                  ? "text-violet-300"
                  : "text-slate-400 hover:text-slate-100")
              }
            >
              <span className="text-lg">👥</span>
              <span>Creators</span>
            </Link>

            {/* Top */}
            <Link
              href="/leaderboard"
              className={
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 " +
                (isActive("/leaderboard")
                  ? "text-violet-300"
                  : "text-slate-400 hover:text-slate-100")
              }
            >
              <span className="text-lg">🏆</span>
              <span>Top</span>
            </Link>

            {/* FAB button */}
            <button
              onClick={() => setFabOpen((prev) => !prev)}
              className="absolute left-1/2 -top-4 z-50 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 text-lg font-bold text-slate-950 shadow-lg shadow-violet-700/60 border border-white/20 active:scale-95 transition-transform"
            >
              {fabOpen ? "×" : "+"}
            </button>

            {/* FAB menu */}
            {fabOpen && (
              <div className="absolute -top-24 left-1/2 z-40 -translate-x-1/2 flex gap-3 rounded-3xl bg-slate-950/98 border border-slate-800 px-4 py-3 shadow-2xl backdrop-blur">
                <button
                  className="flex flex-col items-center text-[10px] gap-1 text-slate-200"
                  onClick={() => {
                    setFabOpen(false);
                    router.push("/create-drop");
                  }}
                >
                  <span className="text-lg">🏛️</span>
                  <span>Create drop</span>
                </button>

                <button
                  className="flex flex-col items-center text-[10px] gap-1 text-slate-200"
                  onClick={() => {
                    setFabOpen(false);
                    router.push("/cart");
                  }}
                >
                  <span className="text-lg">⚡</span>
                  <span>Quick claim</span>
                </button>

                <button
                  className="flex flex-col items-center text-[10px] gap-1 text-slate-200"
                  onClick={() => {
                    setFabOpen(false);
                    router.push("/scan");
                  }}
                >
                  <span className="text-lg">📷</span>
                  <span>Scan</span>
                </button>

                <button
                  className="flex flex-col items-center text-[10px] gap-1 text-slate-200"
                  onClick={() => {
                    setFabOpen(false);
                    router.push("/history");
                  }}
                >
                  <span className="text-lg">🚀</span>
                  <span>Boost</span>
                </button>
              </div>
            )}
          </div>
        </footer>
      )}

      {/* Brand story viewer */}
      {storyOpen && <BrandStoryModal onClose={() => setStoryOpen(false)} />}
    </div>
  );
}

export default function MyApp(
  { 
  Component, pageProps }: AppProps) {
  const router = useRouter();
  const isBot =
  typeof navigator !== "undefined" &&
  (navigator.userAgent.includes("PWABuilder") ||
   navigator.userAgent.includes("Lighthouse"));

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          console.log("Service Worker registered");
        })
        .catch((err) => {
          console.error("Service Worker registration failed", err);
        });
    }
  }, []);
  

  const NO_LAYOUT_ROUTES = ["/landing", "/auth", "/login", "/first-mission" ];

  const disableLayout = NO_LAYOUT_ROUTES.includes(router.pathname);

  if (disableLayout || isBot) {
    // 🔒 Landing / Auth → NO NAV, NO HEADER
    return <Component {...pageProps} />;
  }
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}