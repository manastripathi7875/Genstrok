// components/BottomNavWithFAB.tsx
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Home,
  DollarSign,
  Users,
  Trophy,
  Plus,
  Upload,
  Sparkles,
  ShoppingCart,
} from "lucide-react";

export function BottomNavWithFAB() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const isActive = (path: string) => router.pathname === path;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden">
      <div className="relative mx-auto max-w-md">
        {/* Bottom bar */}
        <div className="bg-[#040714]/95 backdrop-blur flex items-center justify-between px-7 py-3 rounded-t-3xl border border-white/5 shadow-2xl">
          {/* Home */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-0.5 text-[11px] ${
              isActive("/") ? "text-white" : "text-gray-400"
            }`}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Link>

          {/* Earn -> history page use kar raha hu */}
          <Link
            href="/history"
            className={`flex flex-col items-center gap-0.5 text-[11px] ${
              isActive("/history") ? "text-white" : "text-gray-400"
            }`}
          >
            <DollarSign className="h-5 w-5" />
            <span>Earn</span>
          </Link>

          {/* Spacer center, yaha FAB baithega */}
          <div className="w-12" />

          {/* Creators */}
          <Link
            href="/creators"
            className={`flex flex-col items-center gap-0.5 text-[11px] ${
              isActive("/creators") ? "text-white" : "text-gray-400"
            }`}
          >
            <Users className="h-5 w-5" />
            <span>Creators</span>
          </Link>

          {/* Top -> abhi ke liye creator-dashboard pe laga diya */}
          <Link
            href="/creator-dashboard"
            className={`flex flex-col items-center gap-0.5 text-[11px] ${
              isActive("/creator-dashboard") ? "text-white" : "text-gray-400"
            }`}
          >
            <Trophy className="h-5 w-5" />
            <span>Top</span>
          </Link>
        </div>

        {/* FAB */}
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="absolute left-1/2 -top-7 -translate-x-1/2 h-16 w-16 rounded-full bg-gradient-to-tr from-[#a855f7] to-[#ec4899] shadow-xl shadow-purple-900/60 flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
        >
          <Plus
            className={`h-7 w-7 text-white transition-transform ${
              open ? "rotate-45" : ""
            }`}
          />
        </button>

        {/* FAB menu */}
        {open && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex justify-center">
            <div className="bg-[#040714]/98 border border-white/10 rounded-3xl px-4 py-3 flex gap-3 shadow-2xl backdrop-blur">
              {/* Create drop -> /create-drop.tsx */}
              <button
                className="flex flex-col items-center text-[10px] gap-1"
                onClick={() => {
                  setOpen(false);
                  router.push("/create-drop");
                }}
              >
                <Upload className="h-5 w-5" />
                <span>Create drop</span>
              </button>

              {/* Quick claim -> /cart.tsx use kar raha hu */}
              <button
                className="flex flex-col items-center text-[10px] gap-1"
                onClick={() => {
                  setOpen(false);
                  router.push("/cart");
                }}
              >
                <ShoppingCart className="h-5 w-5" />
                <span>Quick claim</span>
              </button>

              {/* Boost / special action -> /history ya koi aur future page */}
              <button
                className="flex flex-col items-center text-[10px] gap-1"
                onClick={() => {
                  setOpen(false);
                  router.push("/history");
                }}
              >
                <Sparkles className="h-5 w-5" />
                <span>Boost</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}