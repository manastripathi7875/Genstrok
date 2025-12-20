// pages/rewards.tsx

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type StreakRow = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
};

type WalletRow = {
  balance: number;
};

type ReferralRow = {
  id: string;
  inviter_id: string;
  invited_user_id: string;
};

export default function RewardsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(true);

  const [streak, setStreak] = useState<StreakRow | null>(null);
  const [streakLoading, setStreakLoading] = useState(true);
  const [streakRewardClaimedToday, setStreakRewardClaimedToday] =
    useState(false);
  const [streakRewardLoading, setStreakRewardLoading] = useState(false);

  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(true);

  const [toast, setToast] = useState<string | null>(null);

  // helper: today date string "YYYY-MM-DD"
  const todayKey = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // streak reward calculation
  function getStreakRewardAmount(current: number): number {
    if (current <= 0) return 0;
    if (current >= 10) return 10;
    return current; // day 1 = 1, day 2 = 2, ... day 10+ = 10
  }

  // initial load
  useEffect(() => {
    async function load() {
      setWalletLoading(true);
      setStreakLoading(true);
      setReferralsLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setNeedsLogin(true);
        setWalletLoading(false);
        setStreakLoading(false);
        setReferralsLoading(false);
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
      } else {
        if (!walletRow) {
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
          setWalletBalance(Number((walletRow as WalletRow).balance ?? 0));
        }
      }
      setWalletLoading(false);

      // streak row
      let streakRow: StreakRow | null = null;
      const { data: streakData, error: streakErr } = await supabase
        .from("user_streaks")
        .select(
          "user_id, current_streak, longest_streak, last_active_date"
        )
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (streakErr && streakErr.code !== "PGRST116") {
        console.error(streakErr);
      }

      if (!streakData) {
        // no row yet, create streak = 1 today
        const { data: created, error: createStreakErr } = await supabase
          .from("user_streaks")
          .insert({
            user_id: currentUser.id,
            current_streak: 1,
            longest_streak: 1,
            last_active_date: todayKey,
          })
          .select(
            "user_id, current_streak, longest_streak, last_active_date"
          )
          .maybeSingle();

        if (createStreakErr) {
          console.error(createStreakErr);
        } else if (created) {
          streakRow = created as any;
        }
      } else {
        streakRow = streakData as any;
        // update streak based on last_active_date
        try {
          const lastDateStr = streakRow.last_active_date;
          const today = new Date(todayKey + "T00:00:00Z");

          if (!lastDateStr) {
            // no last date set, treat as new
            const { data: updated, error: updErr } = await supabase
              .from("user_streaks")
              .update({
                current_streak: 1,
                longest_streak: Math.max(streakRow.longest_streak, 1),
                last_active_date: todayKey,
              })
              .eq("user_id", currentUser.id)
              .select(
                "user_id, current_streak, longest_streak, last_active_date"
              )
              .maybeSingle();

            if (!updErr && updated) {
              streakRow = updated as any;
            }
          } else {
            const last = new Date(lastDateStr + "T00:00:00Z");
            const diffMs = today.getTime() - last.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
              // already counted today
            } else if (diffDays === 1) {
              const newCurrent = (streakRow.current_streak || 0) + 1;
              const newLongest = Math.max(
                newCurrent,
                streakRow.longest_streak || 0
              );
              const { data: updated, error: updErr } = await supabase
                .from("user_streaks")
                .update({
                  current_streak: newCurrent,
                  longest_streak: newLongest,
                  last_active_date: todayKey,
                })
                .eq("user_id", currentUser.id)
                .select(
                  "user_id, current_streak, longest_streak, last_active_date"
                )
                .maybeSingle();

              if (!updErr && updated) {
                streakRow = updated as any;
              }
            } else if (diffDays > 1) {
              // streak broken, reset to 1
              const newLongest = Math.max(
                streakRow.longest_streak || 0,
                1
              );
              const { data: updated, error: updErr } = await supabase
                .from("user_streaks")
                .update({
                  current_streak: 1,
                  longest_streak: newLongest,
                  last_active_date: todayKey,
                })
                .eq("user_id", currentUser.id)
                .select(
                  "user_id, current_streak, longest_streak, last_active_date"
                )
                .maybeSingle();

              if (!updErr && updated) {
                streakRow = updated as any;
              }
            }
          }
        } catch (err) {
          console.error("streak date error", err);
        }
      }

      if (streakRow) {
        setStreak(streakRow);
      }

      // check if streak reward already claimed today
      if (currentUser) {
        const { data: todayReward, error: todayRewardErr } = await supabase
          .from("user_streak_rewards")
          .select("id")
          .eq("user_id", currentUser.id)
          .eq("date_key", todayKey)
          .maybeSingle();

        if (todayRewardErr && todayRewardErr.code !== "PGRST116") {
          console.error(todayRewardErr);
        }
        if (todayReward) {
          setStreakRewardClaimedToday(true);
        }
      }

      setStreakLoading(false);

      // referrals load
      const { data: refData, error: refErr } = await supabase
        .from("user_referrals")
        .select("id, inviter_id, invited_user_id")
        .eq("inviter_id", currentUser.id);

      if (refErr) {
        console.error(refErr);
        setReferrals([]);
      } else {
        setReferrals((refData || []) as any);
      }
      setReferralsLoading(false);
    }

    load();
  }, [todayKey]);

  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;
  const streakReward = getStreakRewardAmount(currentStreak);
  const friendsJoined = referrals.length;

  // referral link: safe for weird preview environments
  const referralLink = useMemo(() => {
    if (!user) return "";

    // server side or build time
    if (typeof window === "undefined") {
      return `/auth?ref=${user.id}`;
    }

    const origin = window.location.origin;

    // some preview or webview cases send null or "undefined"
    if (!origin || origin === "null" || origin === "undefined") {
      return `/auth?ref=${user.id}`;
    }

    // strip trailing slash
    const cleanOrigin = origin.replace(/\/+$/, "");
    return `${cleanOrigin}/auth?ref=${user.id}`;
  }, [user]);

  function showToast(msg: string) {
    setToast(msg);
  }

  async function handleCopyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      showToast("Referral link copied");
    } catch {
      showToast("Could not copy link. Long press and copy manually.");
    }
  }

  async function handleClaimStreakReward() {
    if (!user || !streak) {
      showToast("User not loaded.");
      return;
    }
    if (streakRewardClaimedToday) {
      showToast("You already claimed todays streak reward.");
      return;
    }
    if (streakReward <= 0) {
      showToast("Streak is 0. Come back tomorrow after using the app.");
      return;
    }

    setStreakRewardLoading(true);
    try {
      // insert streak reward row
      const { error: insertErr } = await supabase
        .from("user_streak_rewards")
        .insert({
          user_id: user.id,
          date_key: todayKey,
          streak_at_claim: currentStreak,
          reward_rupees: streakReward,
        });

      if (insertErr) {
        console.error(insertErr);
        showToast("Could not claim streak reward.");
        return;
      }

      const newBalance = walletBalance + streakReward;

      const { data: updated, error: walletErr } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("user_id", user.id)
        .select("balance")
        .maybeSingle();

      if (walletErr) {
        console.error(walletErr);
        showToast("Wallet update failed.");
        return;
      }

      setWalletBalance(
        Number(updated?.balance != null ? updated.balance : newBalance)
      );
      setStreakRewardClaimedToday(true);
      showToast(`+₹${streakReward} added from streak.`);
    } finally {
      setStreakRewardLoading(false);
    }
  }

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-[#050816] text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please log in to view your streaks and referral rewards.
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
              Genstrok growth hub
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-50">
              Streaks, referrals and bonuses
            </h1>
          </div>
        </header>

        {/* hero metrics */}
        <section className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* streak card */}
          <div className="rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-600/30 via-emerald-500/20 to-sky-500/20 px-5 py-4 shadow-xl shadow-emerald-900/40 backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950/80 shadow-inner shadow-black/60 text-3xl">
                  🔥
                </div>
                <div>
                  <p className="text-xs text-emerald-100">Current streak</p>
                  <p className="text-3xl font-bold tracking-tight text-emerald-50">
                    {streakLoading ? "…" : currentStreak}
                  </p>
                  <p className="text-[11px] text-emerald-100/80">
                    Open this page daily to keep the fire on.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-emerald-100/70">
                  Longest streak
                </p>
                <p className="text-xl font-semibold text-emerald-50">
                  {streakLoading ? "…" : longestStreak}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-emerald-50/90">
              Simple language: har din tum Genstrok khologe to streak badhega.
              Jitna streak, utna daily streak reward. Maximum ₹10 per day.
            </p>
          </div>

          {/* wallet + referrals summary */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 px-5 py-4 shadow-lg shadow-slate-950/60 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400">Rupee wallet</p>
                <p className="mt-1 text-2xl font-semibold text-slate-50">
                  ₹ {walletLoading ? "…" : walletBalance.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Streak reward, brand tasks and missions sab yahi add hote
                  rahenge.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Friends joined</p>
                <p className="mt-1 text-xl font-semibold text-slate-50">
                  {referralsLoading ? "…" : friendsJoined}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Referral tracking ready. Payout logic signup ke time pe add
                  hoga.
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Simple language: jitna tum active rahoge aur dost laoge, utna
              tumhara earning engine strong hota jayega.
            </p>
          </div>
        </section>

        {/* streak rewards section */}
        <section className="mb-8">
          <h2 className="text-sm sm:text-base font-semibold text-slate-100 mb-2">
            Daily streak rewards
          </h2>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 px-5 py-4 flex flex-col gap-4">
            {/* visual progress 7 days */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-slate-400">
                Har din jise tum Genstrok ka ye Growth page open karoge,
                streak plus one ho jayega. Streak ke hisaab se daily reward:
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-300">
                <span className="rounded-full bg-slate-800 px-2 py-1">
                  Day 1 → ₹1
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-1">
                  Day 2 → ₹2
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-1">
                  Day 3 → ₹3
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-1">
                  Day 4 → ₹4
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-1">
                  Day 5 → ₹5
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-1">
                  Day 6 → ₹6
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-1">
                  Day 7+ → max ₹10
                </span>
              </div>
            </div>

            {/* 7 bubble progress */}
            <div className="flex items-center gap-2 mt-1">
              {Array.from({ length: 7 }).map((_, idx) => {
                const day = idx + 1;
                const active = currentStreak >= day;
                return (
                  <div
                    key={day}
                    className={
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs " +
                      (active
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-800 text-slate-400")
                    }
                  >
                    {day}
                  </div>
                );
              })}
              <span className="ml-2 text-[11px] text-slate-400">
                Aaj ka streak: {streakLoading ? "…" : currentStreak}
              </span>
            </div>

            {/* claim card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
              <div>
                <p className="text-sm font-semibold text-slate-50">
                  Claim todays streak reward
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Simple language: aaj tum active ho. Iska reward direct rupee
                  wallet me milega. Ek din me sirf ek baar claim.
                </p>
                <p className="mt-1 text-[11px] text-emerald-300">
                  Aaj ka reward:{" "}
                  {streakLoading ? "…" : `₹${streakReward.toFixed(2)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={
                  streakRewardClaimedToday ? undefined : handleClaimStreakReward
                }
                disabled={
                  streakLoading ||
                  streakRewardClaimedToday ||
                  streakRewardLoading ||
                  streakReward <= 0
                }
                className={
                  "w-full sm:w-auto rounded-full px-5 py-2 text-xs sm:text-sm font-semibold " +
                  (streakRewardClaimedToday
                    ? "border border-emerald-500/70 text-emerald-300 opacity-80"
                    : "bg-emerald-500 text-slate-950 hover:bg-emerald-400") +
                  (streakRewardLoading ? " opacity-60" : "")
                }
              >
                {streakRewardClaimedToday
                  ? "Already claimed"
                  : streakRewardLoading
                  ? "Claiming..."
                  : "Claim now"}
              </button>
            </div>
          </div>
        </section>

        {/* referrals section */}
        <section className="mb-8">
          <h2 className="text-sm sm:text-base font-semibold text-slate-100 mb-2">
            Invite friends and grow together
          </h2>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 px-5 py-4 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-2xl">
                  🤝
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-50">
                    Simple language me referral
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Ye link apne dost ko bhejo. Jab wo Genstrok join karke
                    assets claim karenge, tumhare referral stats increase
                    honge. Future version me yahi se unke actions ke hisaab se
                    tumhe bonus payout milega.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Target: students, unemployed youth, creators aur normal
                    users ko ek saath earning aur growth ka track dena.
                  </p>
                </div>
              </div>

              {/* referral link box */}
              <div className="w-full lg:w-[320px]">
                <p className="text-[11px] text-slate-400 mb-1">
                  Your personal invite link
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-2xl bg-slate-900 border border-slate-700 px-3 py-2 text-[11px] break-all">
                    {referralLink || "Loading..."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-violet-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-violet-400 w-full"
                >
                  Copy link
                </button>
              </div>
            </div>

            {/* referral stats */}
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
                <p className="text-[11px] text-slate-400">Friends joined</p>
                <p className="mt-1 text-xl font-semibold text-slate-50">
                  {referralsLoading ? "…" : friendsJoined}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Itne log tumhare link se system me aaye. Aage chalte ye
                  earning unlock karega.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
                <p className="text-[11px] text-slate-400">
                  Referral bonus status
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-50">
                  Backend integration pending
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Jab signup aur first-claim flow stable ho jayega, yahi se per
                  friend payout auto wallet me credit hoga.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
                <p className="text-[11px] text-slate-400">Why it matters</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Jitne jyada active friends, utna jyada drops, brand tasks,
                  resales aur future network effects. Tum basically Genstrok ka
                  local distributor ban jate ho.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* future gamified stuff */}
        <section className="mb-4">
          <h2 className="text-sm sm:text-base font-semibold text-slate-100 mb-2">
            Coming next in this hub
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
              <p className="text-xs font-semibold text-slate-50">
                Streak multipliers
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Long streak pe missions and brand tasks ke reward multiply
                honge. Example: 30 day streak pe 1.5x payout.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
              <p className="text-xs font-semibold text-slate-50">
                Referral ranks
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                City level leaderboard, top referrers ko bonus assets, special
                drops aur branding milega. Ye sab isi page pe show hoga.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
              <p className="text-xs font-semibold text-slate-50">
                Team based earning
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Tum apne friends ke group ko team bana kar challenges complete
                karoge aur pool rewards earn karoge. Pure earning meta yahi se
                control hoga.
              </p>
            </div>
          </div>
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