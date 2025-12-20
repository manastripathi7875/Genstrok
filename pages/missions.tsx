// pages/missions.tsx

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type Mission = {
  id: number; // bigint
  title: string;
  short_description: string | null;
  reward_rupees: number;
  reward_coins: number;
  max_per_day: number;
};

type MissionCompletionMap = Record<number, boolean>;

type BrandTask = {
  id: number; // bigint
  brand_name: string;
  title: string;
  short_description: string | null;
  external_link: string | null;
  reward_rupees: number;
  reward_coins: number;
  max_completions_per_user: number;
};

type BrandTaskCompletionMap = Record<number, boolean>;

export default function MissionsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(true);

  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionLoading, setMissionLoading] = useState(true);
  const [missionCompletedToday, setMissionCompletedToday] =
    useState<MissionCompletionMap>({});

  const [brandTasks, setBrandTasks] = useState<BrandTask[]>([]);
  const [brandTaskLoading, setBrandTaskLoading] = useState(true);
  const [brandTaskCompleted, setBrandTaskCompleted] =
    useState<BrandTaskCompletionMap>({});

  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const todayKey = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  function showToast(msg: string) {
    setToast(msg);
  }

  // user + wallet + missions + tasks
  useEffect(() => {
    async function load() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setNeedsLogin(true);
        setWalletLoading(false);
        setMissionLoading(false);
        setBrandTaskLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);

      // wallet
      const { data: walletRow, error: walletErr } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (walletErr && walletErr.code !== "PGRST116") {
        console.error(walletErr);
        setWalletBalance(0);
      } else if (!walletRow) {
        const { data: created, error: createErr } = await supabase
          .from("wallets")
          .insert({ user_id: currentUser.id, balance: 0 })
          .select("balance")
          .maybeSingle();

        if (createErr) {
          console.error(createErr);
          setWalletBalance(0);
        } else {
          setWalletBalance(Number(created?.balance ?? 0));
        }
      } else {
        setWalletBalance(Number(walletRow.balance ?? 0));
      }
      setWalletLoading(false);

      // daily missions
      const { data: missionData, error: missionErr } = await supabase
        .from("daily_missions")
        .select(
          "id, title, short_description, reward_rupees, reward_coins, max_per_day"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (missionErr) {
        console.error(missionErr);
        setMissions([]);
      } else {
        setMissions((missionData || []) as Mission[]);
      }

      // mission completions for today
      const { data: completionData, error: completionErr } = await supabase
        .from("daily_mission_completions")
        .select("mission_id")
        .eq("user_id", currentUser.id)
        .eq("date_key", todayKey);

      if (completionErr) {
        console.error(completionErr);
      } else {
        const map: MissionCompletionMap = {};
        (completionData || []).forEach((row: any) => {
          map[row.mission_id] = true;
        });
        setMissionCompletedToday(map);
      }
      setMissionLoading(false);

      // brand tasks
      const { data: brandData, error: brandErr } = await supabase
        .from("brand_tasks")
        .select(
          "id, brand_name, title, short_description, external_link, reward_rupees, reward_coins, max_completions_per_user"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (brandErr) {
        console.error(brandErr);
        setBrandTasks([]);
      } else {
        setBrandTasks((brandData || []) as BrandTask[]);
      }

      const { data: brandCompletionData, error: brandCompletionErr } =
        await supabase
          .from("brand_task_completions")
          .select("task_id")
          .eq("user_id", currentUser.id);

      if (brandCompletionErr) {
        console.error(brandCompletionErr);
      } else {
        const map: BrandTaskCompletionMap = {};
        (brandCompletionData || []).forEach((row: any) => {
          map[row.task_id] = true;
        });
        setBrandTaskCompleted(map);
      }
      setBrandTaskLoading(false);
    }

    load();
  }, [todayKey]);

  async function handleCompleteMission(mission: Mission) {
    if (!user) {
      showToast("Please log in first.");
      return;
    }
    if (missionCompletedToday[mission.id]) {
      showToast("You already completed this mission today.");
      return;
    }

    setActionLoadingId(mission.id);
    try {
      const { error: insertErr } = await supabase
        .from("daily_mission_completions")
        .insert({
          user_id: user.id,
          mission_id: mission.id,
          date_key: todayKey,
          reward_rupees: mission.reward_rupees,
          reward_coins: mission.reward_coins,
        });

      if (insertErr) {
        console.error(insertErr);
        showToast("Could not mark mission as done.");
        return;
      }

      const payout = Number(mission.reward_rupees || 0);

      if (payout > 0) {
        try {
          const { error: rpcErr } = await supabase.rpc(
            "add_wallet_balance",
            { uid: user.id, amount: payout }
          );
          if (rpcErr) {
            console.error(rpcErr);
          } else {
            setWalletBalance((prev) => prev + payout);
          }
        } catch (err) {
          console.error("Mission payout error", err);
        }
      }

      setMissionCompletedToday((prev) => ({
        ...prev,
        [mission.id]: true,
      }));

      showToast(
        `Mission completed. +₹${payout.toFixed(
          2
        )} added to your wallet.`
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCompleteBrandTask(task: BrandTask) {
    if (!user) {
      showToast("Please log in first.");
      return;
    }
    if (brandTaskCompleted[task.id]) {
      showToast("You already completed this task.");
      return;
    }

    setActionLoadingId(task.id);
    try {
      const { error: insertErr } = await supabase
        .from("brand_task_completions")
        .insert({
          user_id: user.id,
          task_id: task.id,
          status: "completed",
          reward_rupees: task.reward_rupees,
          reward_coins: task.reward_coins,
        });

      if (insertErr) {
        console.error(insertErr);
        showToast("Could not mark task as done.");
        return;
      }

      const payout = Number(task.reward_rupees || 0);

      if (payout > 0) {
        try {
          const { error: rpcErr } = await supabase.rpc(
            "add_wallet_balance",
            { uid: user.id, amount: payout }
          );
          if (rpcErr) {
            console.error(rpcErr);
          } else {
            setWalletBalance((prev) => prev + payout);
          }
        } catch (err) {
          console.error("Task payout error", err);
        }
      }

      setBrandTaskCompleted((prev) => ({
        ...prev,
        [task.id]: true,
      }));

      showToast(
        `Task completed. +₹${payout.toFixed(2)} added to your wallet.`
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-[#050816] text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please log in to access missions and brand tasks.
          </p>
          <a
            href="/auth"
            className="mt-4 inline-flex rounded-full bg-violet-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-400"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 pb-20">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-6 pb-6 sm:px-6">
        {/* header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/wallet")}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/80 px-4 py-2 text-xs sm:text-sm text-slate-200"
          >
            <span>←</span>
            <span>Back to Earn tab</span>
          </button>
          <div className="text-right">
            <p className="text-[11px] sm:text-xs text-slate-400">
              Genstrok missions
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-50">
              Daily missions & brand tasks
            </h1>
          </div>
        </header>

        {/* summary cards */}
        <section className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-600/30 via-emerald-500/20 to-sky-500/20 px-5 py-4 shadow-xl shadow-emerald-900/40 backdrop-blur">
            <p className="text-xs text-emerald-100">
              Today&apos;s earning missions
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-50">
              Tap, complete, get instant wallet money.
            </p>
            <p className="mt-2 text-[11px] text-emerald-100/85">
              Simple version: jinke paas skill nahi, sirf time hai, woh yahan
              se daily chhoti chhoti earning kar sakte hain. Missions follow
              karo, kaam complete karo, button dabao, reward wallet me.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 px-5 py-4 shadow-lg shadow-slate-950/60 flex flex-col justify-between">
            <div>
              <p className="text-xs text-slate-400">
                Rupee wallet balance
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-50">
                ₹ {walletLoading ? "…" : walletBalance.toFixed(2)}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Streak rewards, missions, brand tasks, referrals – sab yahi add
                honge. Ye tumhara Genstrok earning meter hai.
              </p>
            </div>
          </div>
        </section>

        {/* daily missions */}
        <section className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              Daily missions
            </h2>
            <p className="text-[10px] text-slate-400">
              Reset every midnight · per day limited slots
            </p>
          </div>

          {missionLoading ? (
            <p className="text-xs text-slate-400">Loading missions…</p>
          ) : missions.length === 0 ? (
            <p className="text-xs text-slate-400">
              No missions configured yet. Admin can add missions from the
              database.
            </p>
          ) : (
            <div className="space-y-3">
              {missions.map((m) => {
                const done = !!missionCompletedToday[m.id];
                const payout = Number(m.reward_rupees || 0);
                const coins = Number(m.reward_coins || 0);

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/85 px-4 py-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-50">
                          {m.title}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {m.short_description ||
                            "Follow the instructions and then mark as done to receive reward."}
                        </p>
                      </div>
                      <div className="text-right text-[11px]">
                        {payout > 0 && (
                          <p className="text-emerald-300">
                            +₹{payout.toFixed(2)}
                          </p>
                        )}
                        {coins > 0 && (
                          <p className="text-sky-300">
                            +{coins} {BRAND.coinName}
                          </p>
                        )}
                        <p className="mt-1 text-slate-500">
                          Max {m.max_per_day} / day
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-1">
                      <p className="text-[10px] text-slate-500">
                        Easy language: kaam khatam karne ke baad hi button
                        dabana, warna fake complete karoge to future me proof
                        system aayega.
                      </p>
                      <button
                        type="button"
                        onClick={
                          done ? undefined : () => handleCompleteMission(m)
                        }
                        disabled={done || actionLoadingId === m.id}
                        className={
                          "shrink-0 rounded-full px-4 py-1.5 text-[11px] font-semibold " +
                          (done
                            ? "border border-emerald-500/70 text-emerald-300"
                            : "bg-emerald-500 text-slate-950 hover:bg-emerald-400") +
                          (actionLoadingId === m.id ? " opacity-70" : "")
                        }
                      >
                        {done
                          ? "Completed today"
                          : actionLoadingId === m.id
                          ? "Processing…"
                          : "Mark as done"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* brand tasks */}
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              Brand & local business tasks
            </h2>
            <p className="text-[10px] text-slate-400">
              Real companies, real campaigns, real payouts (dev mode abhi)
            </p>
          </div>

          {brandTaskLoading ? (
            <p className="text-xs text-slate-400">Loading tasks…</p>
          ) : brandTasks.length === 0 ? (
            <p className="text-xs text-slate-400">
              No brand tasks live right now. Future me yahi pe companies apne
              campaigns daalenge.
            </p>
          ) : (
            <div className="space-y-3">
              {brandTasks.map((t) => {
                const done = !!brandTaskCompleted[t.id];
                const payout = Number(t.reward_rupees || 0);
                const coins = Number(t.reward_coins || 0);

                return (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/85 px-4 py-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] text-slate-400">
                          {t.brand_name}
                        </p>
                        <p className="text-sm font-semibold text-slate-50">
                          {t.title}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {t.short_description ||
                            "Follow the task instructions from this brand and then mark as done."}
                        </p>
                      </div>
                      <div className="text-right text-[11px]">
                        {payout > 0 && (
                          <p className="text-emerald-300">
                            +₹{payout.toFixed(2)}
                          </p>
                        )}
                        {coins > 0 && (
                          <p className="text-sky-300">
                            +{coins} {BRAND.coinName}
                          </p>
                        )}
                        <p className="mt-1 text-slate-500">
                          Max {t.max_completions_per_user} per user
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {t.external_link && (
                          <a
                            href={t.external_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-200 hover:bg-slate-800"
                          >
                            Open task page
                          </a>
                        )}
                        <span>
                          Simple: brand ka kaam complete karo, proof ke saath
                          button dabao, reward wallet me aata hai.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={
                          done ? undefined : () => handleCompleteBrandTask(t)
                        }
                        disabled={done || actionLoadingId === t.id}
                        className={
                          "shrink-0 rounded-full px-4 py-1.5 text-[11px] font-semibold " +
                          (done
                            ? "border border-emerald-500/70 text-emerald-300"
                            : "bg-violet-500 text-slate-950 hover:bg-violet-400") +
                          (actionLoadingId === t.id ? " opacity-70" : "")
                        }
                      >
                        {done
                          ? "Task completed"
                          : actionLoadingId === t.id
                          ? "Processing…"
                          : "Mark as done"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-16 inset-x-0 flex justify-center z-50 px-4">
          <div className="max-w-sm rounded-full bg-slate-900/90 px-4 py-2 text-[11px] text-slate-100 border border-slate-700/70 shadow-lg shadow-black/60 text-center">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}