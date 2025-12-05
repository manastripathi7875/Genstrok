import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type LeaderRow = {
  buyer_id: string | null;
  buyer_name: string | null;
  total_coins: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Aggregate coins per user
      const { data, error } = await supabase.rpc("leaderboard_view");

      if (error) {
        console.error(error);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => b.total_coins - a.total_coins);
  }, [rows]);

  return (
    <div className="relative mx-auto max-w-5xl px-4 pt-4 pb-20 sm:px-6 min-h-screen text-slate-50 bg-slate-950">

      {/* background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <header className="relative mb-5">
        <h1 className="text-xl font-semibold">Top Creators & Collectors</h1>
        <p className="text-[12px] text-slate-300">
          Ranked by total {BRAND.coinName}
        </p>
      </header>

      {loading ? (
        <p className="text-slate-400 text-xs">Loading leaderboard…</p>
      ) : sorted.length === 0 ? (
        <p className="text-slate-400 text-xs">No data available yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((r, i) => {
            const rank = i + 1;
            let color =
              rank === 1
                ? "text-yellow-300"
                : rank === 2
                ? "text-slate-200"
                : rank === 3
                ? "text-amber-600"
                : "text-slate-300";

            return (
              <div
                key={r.buyer_id || i}
                className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-950/80 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`text-lg font-bold w-7 text-center ${color}`}
                  >
                    {rank}
                  </div>

                  <div className="h-9 w-9 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 text-xs">
                    {(r.buyer_name || "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-50 line-clamp-1">
                      {r.buyer_name || "Anonymous User"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {r.total_coins} {BRAND.coinName}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}