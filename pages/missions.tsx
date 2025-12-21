import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";
import { insertLedgerEntry } from "../lib/ledger";

/* ================= TYPES ================= */

type Mission = {
  id: number;
  title: string;
  short_description: string | null;
  reward_rupees: number;
  reward_coins: number;
  max_per_day: number;
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

  /* -------- auth -------- */
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  /* -------- wallet -------- */
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);

  /* -------- missions -------- */
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionDone, setMissionDone] = useState<CompletionMap>({});
  const [missionLoading, setMissionLoading] = useState(true);

  /* -------- brand tasks -------- */
  const [brandTasks, setBrandTasks] = useState<BrandTask[]>([]);
  const [brandDone, setBrandDone] = useState<CompletionMap>({});
  const [brandLoading, setBrandLoading] = useState(true);

  /* -------- ui -------- */
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const todayKey = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );

  /* ================= TOAST ================= */

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(msg: string) {
    setToast(msg);
  }

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setNeedsLogin(true);
        return;
      }

      setUser(auth.user);

      /* wallet */
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      setWalletBalance(Number(wallet?.balance || 0));
      setWalletLoading(false);

      /* daily missions */
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

      /* brand tasks */
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

  /* ================= ACTIONS ================= */

  async function completeMission(m: Mission) {
    if (missionDone[m.id]) return;
    setActionLoading(m.id);

    await supabase.from("daily_mission_completions").insert({
      user_id: user.id,
      mission_id: m.id,
      date_key: todayKey,
    });

    await insertLedgerEntry({
      user_id: user.id,
      source_type: "daily_mission",
      source_id: String(m.id),
      points: m.reward_coins,
    });

    if (m.reward_rupees > 0) {
      await supabase.rpc("add_wallet_balance", {
        uid: user.id,
        amount: m.reward_rupees,
      });
      setWalletBalance((p) => p + m.reward_rupees);
    }

    setMissionDone((p) => ({ ...p, [m.id]: true }));
    showToast(`+₹${m.reward_rupees} added`);
    setActionLoading(null);
  }

  async function completeBrand(t: BrandTask) {
    if (brandDone[t.id]) return;
    setActionLoading(t.id);

    await supabase.from("brand_task_completions").insert({
      user_id: user.id,
      task_id: t.id,
      status: "completed",
    });

    await insertLedgerEntry({
      user_id: user.id,
      source_type: "brand_task",
      source_id: String(t.id),
      points: t.reward_coins,
      weight: 2,
    });

    if (t.reward_rupees > 0) {
      await supabase.rpc("add_wallet_balance", {
        uid: user.id,
        amount: t.reward_rupees,
      });
      setWalletBalance((p) => p + t.reward_rupees);
    }

    setBrandDone((p) => ({ ...p, [t.id]: true }));
    showToast(`+₹${t.reward_rupees} added`);
    setActionLoading(null);
  }

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
                      <p
                        className="text-sm font-semibold cursor-pointer hover:underline"
                        onClick={() =>
                          router.push(`/missions/mission/${m.id}`)
                        }
                      >
                        {m.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {m.short_description}
                      </p>
                    </div>
                    <span className="text-emerald-400 text-sm">
                      +₹{m.reward_rupees}
                    </span>
                  </div>

                  <button
                    disabled={missionDone[m.id]}
                    onClick={() => completeMission(m)}
                    className={`mt-4 w-full rounded-full py-2 font-semibold ${
                      missionDone[m.id]
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-emerald-500 text-black"
                    }`}
                  >
                    {missionDone[m.id]
                      ? "Completed Today"
                      : actionLoading === m.id
                      ? "Processing…"
                      : "Quick Complete"}
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
                  <p
                    className="font-semibold cursor-pointer hover:underline"
                    onClick={() =>
                      router.push(`/missions/brand/${t.id}`)
                    }
                  >
                    {t.title}
                  </p>

                  <button
                    disabled={brandDone[t.id]}
                    onClick={() => completeBrand(t)}
                    className={`mt-4 w-full rounded-full py-2 font-semibold ${
                      brandDone[t.id]
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-violet-500 text-black"
                    }`}
                  >
                    {brandDone[t.id]
                      ? "Completed"
                      : "Start Task"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* PROJECTS */}
        {activeTab === "projects" && (
          <div className="mt-10 text-center text-slate-400 text-sm">
            Projects system coming next (client posted work).
          </div>
        )}

        {/* MY WORK */}
        {activeTab === "my" && (
          <div className="mt-10 text-center text-slate-400 text-sm">
            Your submitted & approved work will appear here.
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center">
          <div className="bg-black px-5 py-2 rounded-full border border-slate-700 text-sm">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}