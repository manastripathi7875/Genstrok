// pages/missions.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

/* ================= TYPES ================= */

type Mission = {
  id: number;
  title: string;
  short_description: string | null;
  reward_rupees: number;
  reward_coins: number;
};

type BrandTask = {
  id: number;
  brand_name: string;
  title: string;
  short_description: string | null;
  reward_rupees: number;
  reward_coins: number;
};

type CompletionMap = Record<number, boolean>;
type Tab = "daily" | "brand" | "projects" | "my";

/* ================= PAGE ================= */

export default function MissionsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);

  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionDone, setMissionDone] = useState<CompletionMap>({});
  const [missionLoading, setMissionLoading] = useState(true);

  const [brandTasks, setBrandTasks] = useState<BrandTask[]>([]);
  const [brandDone, setBrandDone] = useState<CompletionMap>({});
  const [brandLoading, setBrandLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<Tab>("daily");

  const todayKey = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setNeedsLogin(true);
        return;
      }

      setUser(auth.user);

      // wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      setWalletBalance(Number(wallet?.balance || 0));
      setWalletLoading(false);

      // daily missions
      const { data: m } = await supabase
        .from("daily_missions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      setMissions(m || []);

      const { data: mc } = await supabase
        .from("daily_mission_completions")
        .select("mission_id")
        .eq("user_id", auth.user.id)
        .eq("date_key", todayKey);

      const mMap: CompletionMap = {};
      (mc || []).forEach((r: any) => (mMap[r.mission_id] = true));
      setMissionDone(mMap);
      setMissionLoading(false);

      // brand tasks
      const { data: b } = await supabase
        .from("brand_tasks")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      setBrandTasks(b || []);

      const { data: bc } = await supabase
        .from("brand_task_completions")
        .select("task_id")
        .eq("user_id", auth.user.id);

      const bMap: CompletionMap = {};
      (bc || []).forEach((r: any) => (bMap[r.task_id] = true));
      setBrandDone(bMap);
      setBrandLoading(false);
    }

    load();
  }, [todayKey]);

  /* ================= LOGIN ================= */

  if (needsLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <button
          onClick={() => router.push("/auth")}
          className="px-6 py-3 rounded-full bg-violet-500 text-black font-semibold"
        >
          Login to continue
        </button>
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-[#050816] text-white pb-24 px-4">
      <div className="max-w-5xl mx-auto pt-6">

        {/* HEADER */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-black border border-slate-800 p-6">
          <p className="text-xs text-slate-400">Genstrok Workplace</p>
          <h1 className="text-2xl font-semibold">
            One place to work, earn & grow
          </h1>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl bg-black/40 p-4">
              <p className="text-xs text-slate-400">Wallet</p>
              <p className="text-xl font-semibold">
                ₹{walletLoading ? "…" : walletBalance.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-black/40 p-4">
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-xl font-semibold">Active</p>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mt-6 text-sm">
          {[
            ["daily", "Daily Tasks"],
            ["brand", "Brand Work"],
            ["projects", "Projects"],
            ["my", "My Work"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setActiveTab(k as Tab)}
              className={`px-4 py-2 rounded-full ${
                activeTab === k
                  ? "bg-violet-500 text-black"
                  : "bg-slate-900"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* DAILY TASKS */}
        {activeTab === "daily" && (
          <div className="mt-6 space-y-4">
            {missionLoading ? (
              <p className="text-slate-400 text-sm">Loading…</p>
            ) : (
              missions.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl bg-slate-900 border border-slate-800 p-5"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-semibold">{m.title}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {m.short_description}
                      </p>
                    </div>
                    <span className="text-emerald-400 text-sm">
                      +₹{m.reward_rupees}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      router.push(`/missions/mission/${m.id}`)
                    }
                    className={`mt-4 w-full rounded-full py-2 font-semibold ${
                      missionDone[m.id]
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-emerald-500 text-black"
                    }`}
                  >
                    {missionDone[m.id]
                      ? "Completed Today"
                      : "View task"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* BRAND TASKS */}
        {activeTab === "brand" && (
          <div className="mt-6 space-y-4">
            {brandLoading ? (
              <p className="text-slate-400 text-sm">Loading…</p>
            ) : (
              brandTasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl bg-slate-900 border border-slate-800 p-5"
                >
                  <p className="text-xs text-slate-400">{t.brand_name}</p>
                  <p className="font-semibold">{t.title}</p>

                  <button
                    onClick={() =>
                      router.push(`/missions/brand/${t.id}`)
                    }
                    className={`mt-4 w-full rounded-full py-2 font-semibold ${
                      brandDone[t.id]
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-violet-500 text-black"
                    }`}
                  >
                    {brandDone[t.id]
                      ? "Completed"
                      : "View task"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* PROJECTS */}
        {activeTab === "projects" && (
          <div className="mt-10 text-center text-slate-400 text-sm">
            Client posted projects coming next.
          </div>
        )}

        {/* MY WORK */}
        {activeTab === "my" && (
          <div className="mt-10 text-center text-slate-400 text-sm">
            Submitted proofs & approvals will appear here.
          </div>
        )}
      </div>
    </div>
  );
}