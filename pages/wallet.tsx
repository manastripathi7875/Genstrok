// pages/wallet.tsx

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";
import { insertLedgerEntry } from "../lib/ledger";
declare global {
  interface Window {
    Razorpay: any;
  }
}

type OwnershipRow = {
  id: string;
  created_at: string;
  item_id: string;
  buyer_name: string | null;
  buyer_id: string | null;
  coins: number | null;
};

type ItemRow = {
  id: string;
  title: string;
  cover_url?: string | null;
};

type ListingRow = {
  id: string;
  item_id: number;
  seller_id: string;
  ask_price: number;
  status: string;
};

type OwnedAsset = {
  itemId: string;
  title: string;
  cover_url?: string | null;
};

type MissionRow = {
  id: number;
  title: string;
  description: string | null;
  reward_rupees: number;
};

type BrandTaskRow = {
  id: number;
  title: string;
  description: string | null;
  brand_name: string | null;
  location_tag: string | null;
  external_link: string | null;
  reward_rupees: number;
};

export default function WalletPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [rows, setRows] = useState<OwnershipRow[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, ItemRow>>({});
  const [loading, setLoading] = useState(true);

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [topupLoadingAmount, setTopupLoadingAmount] = useState<number | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);

  const [coinPulse, setCoinPulse] = useState(false);

  // resale listings
  const [listingsByItem, setListingsByItem] = useState<
    Record<string, ListingRow>
  >({});
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingActionItemId, setListingActionItemId] = useState<number | null>(
    null
  );

  // missions
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [completedMissionIdsToday, setCompletedMissionIdsToday] = useState<
    number[]
  >([]);
  const [missionActionId, setMissionActionId] = useState<number | null>(null);

  // brand tasks
  const [brandTasks, setBrandTasks] = useState<BrandTaskRow[]>([]);
  const [brandTasksLoading, setBrandTasksLoading] = useState(true);
  const [completedBrandTaskIds, setCompletedBrandTaskIds] = useState<number[]>(
    []
  );
  const [brandTaskActionId, setBrandTaskActionId] = useState<number | null>(
    null
  );
  
useEffect(() => {
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  document.body.appendChild(script);

  return () => {
    document.body.removeChild(script);
  };
}, []);
    // initial load
  useEffect(() => {
    async function load() {
      setLoading(true);
      setWalletLoading(true);
      setListingsLoading(true);
      setMissionsLoading(true);
      setBrandTasksLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setNeedsLogin(true);
        setLoading(false);
        setWalletLoading(false);
        setListingsLoading(false);
        setMissionsLoading(false);
        setBrandTasksLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);

      // OWNERSHIPS
      const { data: ownData, error: ownError } = await supabase
        .from("ownerships")
        .select("id, created_at, item_id, buyer_name, buyer_id, coins")
        .eq("buyer_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (ownError) {
        console.error(ownError);
        setRows([]);
      } else {
        const owns = (ownData || []) as OwnershipRow[];
        setRows(owns);

        const ids = Array.from(
          new Set(owns.map((o) => o.item_id).filter(Boolean))
        );

        if (ids.length > 0) {
          const { data: itemData, error: itemError } = await supabase
            .from("items")
            .select("id, title, cover_url")
            .in("id", ids);

          if (!itemError && itemData) {
            const map: Record<string, ItemRow> = {};
            (itemData || []).forEach((it: any) => {
              map[String(it.id)] = {
                id: String(it.id),
                title: it.title,
                cover_url: it.cover_url,
              };
            });
            setItemsById(map);
          }
        }
      }

      setLoading(false);

      // WALLET
      const { data: walletRow, error: walletError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (walletError && walletError.code !== "PGRST116") {
        console.error(walletError);
        setWalletBalance(0);
        setWalletLoading(false);
      } else {
        if (!walletRow) {
          const { data: created, error: createError } = await supabase
            .from("wallets")
            .insert({
              user_id: currentUser.id,
              balance: 0,
            })
            .select("balance")
            .maybeSingle();

          if (createError) {
            console.error(createError);
            setWalletBalance(0);
          } else {
            setWalletBalance(Number(created?.balance || 0));
          }
        } else {
          setWalletBalance(Number(walletRow.balance || 0));
        }
        setWalletLoading(false);
      }

      // RESELL LISTINGS
      const { data: listingData, error: listingError } = await supabase
        .from("resale_listings")
        .select("id, item_id, seller_id, ask_price, status")
        .eq("seller_id", currentUser.id)
        .in("status", ["active"]);

      if (listingError) {
        console.error(listingError);
        setListingsByItem({});
      } else {
        const map: Record<string, ListingRow> = {};
        (listingData || []).forEach((l: any) => {
          map[String(l.item_id)] = {
            id: l.id,
            item_id: Number(l.item_id),
            seller_id: l.seller_id,
            ask_price: Number(l.ask_price),
            status: l.status,
          };
        });
        setListingsByItem(map);
      }
      setListingsLoading(false);

      // DAILY MISSIONS
      const todayKey = new Date().toISOString().slice(0, 10);

      const { data: missionsData, error: missionsError } = await supabase
        .from("daily_missions")
        .select("id, title, description, reward_rupees, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

      if (missionsError) {
        console.error(missionsError);
        setMissions([]);
      } else {
        const list: MissionRow[] = (missionsData || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          reward_rupees: Number(m.reward_rupees ?? 0),
        }));
        setMissions(list);
      }

      const { data: progressData, error: progressError } = await supabase
        .from("user_daily_missions")
        .select("mission_id")
        .eq("user_id", currentUser.id)
        .eq("date_key", todayKey);

      if (progressError) {
        console.error(progressError);
        setCompletedMissionIdsToday([]);
      } else {
        setCompletedMissionIdsToday(
          (progressData || []).map((p: any) => p.mission_id as number)
        );
      }

      setMissionsLoading(false);

      // BRAND TASKS
      const { data: brandData, error: brandError } = await supabase
        .from("brand_tasks")
        .select(
          "id, title, description, brand_name, location_tag, external_link, reward_rupees, is_active, sort_order"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

      if (brandError) {
        console.error(brandError);
        setBrandTasks([]);
      } else {
        const list: BrandTaskRow[] = (brandData || []).map((b: any) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          brand_name: b.brand_name,
          location_tag: b.location_tag,
          external_link: b.external_link,
          reward_rupees: Number(b.reward_rupees ?? 0),
        }));
        setBrandTasks(list);
      }

      const { data: brandProgress, error: brandProgressErr } = await supabase
        .from("user_brand_tasks")
        .select("task_id")
        .eq("user_id", currentUser.id);

      if (brandProgressErr) {
        console.error(brandProgressErr);
        setCompletedBrandTaskIds([]);
      } else {
        setCompletedBrandTaskIds(
          (brandProgress || []).map((p: any) => p.task_id as number)
        );
      }

      setBrandTasksLoading(false);
    }

    load();
  }, []);

  // realtime ownership updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("wallet-ownerships")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ownerships",
        },
        (payload) => {
          const newRow = payload.new as OwnershipRow;
          if (newRow.buyer_id !== user.id) return;

          setRows((prev) => [newRow, ...prev]);

          if (newRow.item_id && !itemsById[newRow.item_id]) {
            supabase
              .from("items")
              .select("id, title, cover_url")
              .eq("id", newRow.item_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setItemsById((prev) => ({
                    ...prev,
                    [String(data.id)]: {
                      id: String(data.id),
                      title: data.title,
                      cover_url: data.cover_url,
                    },
                  }));
                }
              });
          }

          setCoinPulse(true);
          setTimeout(() => setCoinPulse(false), 900);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, itemsById]);

  const totalCoins = useMemo(
    () => rows.reduce((sum, r) => sum + (r.coins ? r.coins : 0), 0),
    [rows]
  );

  const ownedAssets: OwnedAsset[] = useMemo(() => {
    const seen = new Set<string>();
    const list: OwnedAsset[] = [];

    rows.forEach((row) => {
      const key = String(row.item_id);
      if (seen.has(key)) return;
      seen.add(key);
      const item = itemsById[key];
      list.push({
        itemId: key,
        title: item?.title || "Claimed asset",
        cover_url: item?.cover_url ?? null,
      });
    });

    return list;
  }, [rows, itemsById]);

  const visibleRows = rows.slice(0, 5);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function handleRazorpayTopup(amount: number) {
  if (!user) {
    showToast("Please login first");
    return;
  }

  try {
    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, user_id: user.id }),
    });

    const data = await res.json();

    const options = {
      key: data.key,
      amount: data.amount,
      currency: "INR",
      order_id: data.orderId,
      name: "Genstrok Wallet",
      description: "Wallet Topup",
      notes: {
        user_id: user.id, // 🔥 THIS IS CRITICAL
      },
      handler: async function (response: any) {
  try {
    // 1. Verify payment on backend
  await fetch("/api/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
        amount,
        user_id: user.id,
      }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      showToast("Payment verification failed");
      return;
    }

    // 2. Update wallet locally
    setWalletBalance((prev) => prev + amount);

    showToast("Payment successful. Wallet updated.");
    window.location.reload();
  } catch (err) {
    console.error(err);
    showToast("Payment verification error");
  }
},
      theme: { color: "#7c3aed" },
    };

    // @ts-ignore
    const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      showToast("Payment failed");
    }
}
  // DEV topup
  async function handleTopup(amount: number) {
    if (!user) {
      showToast("Please log in first.");
      return;
    }
    setTopupLoadingAmount(amount);

    try {
      const { error: insertError } = await supabase
        .from("wallet_topups")
        .insert({
          user_id: user.id,
          amount,
          status: "success",
          source: "dev-topup",
        });

      if (insertError) {
        console.error(insertError);
        showToast("Could not add money.");
        return;
      }

      const newBalance = walletBalance + amount;

      const { data: updated, error: updateError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("user_id", user.id)
        .select("balance")
        .maybeSingle();

      if (updateError) {
        console.error(updateError);
        showToast("Wallet update failed.");
        return;
      }

      setWalletBalance(Number(updated?.balance || newBalance));
      showToast(`₹${amount} added to your wallet (test mode).`);
    } finally {
      setTopupLoadingAmount(null);
    }
  }

  // create / update listing
  async function handleCreateOrUpdateListing(itemIdRaw: string) {
    if (!user) {
      showToast("Please log in first.");
      return;
    }

    const itemId = Number(itemIdRaw);
    const key = String(itemId);
    const existing = listingsByItem[key];

    const priceStr = window.prompt(
      existing
        ? "Update resale price in ₹ (example: 99)"
        : "Set resale price in ₹ (example: 99)"
    );
    if (!priceStr) return;

    const price = Number(priceStr);
    if (!Number.isFinite(price) || price <= 0) {
      showToast("Enter a valid price in rupees.");
      return;
    }

    setListingActionItemId(itemId);
    try {
      if (existing) {
        const { data, error } = await supabase
          .from("resale_listings")
          .update({ ask_price: price, status: "active" })
          .eq("id", existing.id)
          .select("id, item_id, seller_id, ask_price, status")
          .maybeSingle();

        if (error || !data) {
          console.error(error);
          showToast("Could not update listing.");
          return;
        }

        setListingsByItem((prev) => ({
          ...prev,
          [key]: {
            id: data.id,
            item_id: Number(data.item_id),
            seller_id: data.seller_id,
            ask_price: Number(data.ask_price),
            status: data.status,
          },
        }));
        showToast("Listing updated.");
      } else {
        const { data, error } = await supabase
          .from("resale_listings")
          .insert({
            item_id: itemId,
            seller_id: user.id,
            ask_price: price,
            status: "active",
          })
          .select("id, item_id, seller_id, ask_price, status")
          .maybeSingle();

        if (error || !data) {
          console.error(error);
          showToast("Could not create listing.");
          return;
        }

        setListingsByItem((prev) => ({
          ...prev,
          [key]: {
            id: data.id,
            item_id: Number(data.item_id),
            seller_id: data.seller_id,
            ask_price: Number(data.ask_price),
            status: data.status,
          },
        }));
        showToast("Asset listed for resale.");
      }
    } finally {
      setListingActionItemId(null);
    }
  }

  // cancel listing
  async function handleCancelListing(itemIdRaw: string) {
    const itemId = Number(itemIdRaw);
    const key = String(itemId);
    const existing = listingsByItem[key];
    if (!existing) return;

    const confirmRemove = window.confirm(
      "Remove this asset from resale? Buyers will no longer see this listing."
    );
    if (!confirmRemove) return;

    setListingActionItemId(itemId);
    try {
      const { error } = await supabase
        .from("resale_listings")
        .update({ status: "cancelled" })
        .eq("id", existing.id);

      if (error) {
        console.error(error);
        showToast("Could not cancel listing.");
        return;
      }

      setListingsByItem((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      showToast("Listing cancelled.");
    } finally {
      setListingActionItemId(null);
    }
  }

  // complete mission (daily rupee reward)
  async function handleCompleteMission(mission: MissionRow) {
    if (!user) {
      showToast("Please log in first.");
      return;
    }

    const todayKey = new Date().toISOString().slice(0, 10);

    if (completedMissionIdsToday.includes(mission.id)) {
      showToast("You already claimed this mission today.");
      return;
    }

    setMissionActionId(mission.id);

    try {
      const { error: insertError } = await supabase
        .from("user_daily_missions")
        .insert({
          user_id: user.id,
          mission_id: mission.id,
          date_key: todayKey,
          reward_rupees: mission.reward_rupees,
        });

      if (insertError) {
        console.error(insertError);
        showToast("Could not complete mission.");
        return;
      }

      const newBalance = walletBalance + mission.reward_rupees;

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

      setWalletBalance(Number(updated?.balance ?? newBalance));

      setCompletedMissionIdsToday((prev) => [...prev, mission.id]);
      showToast(
        `Mission completed. +₹${mission.reward_rupees} added to wallet.`
      );
    } finally {
      setMissionActionId(null);
    }
  }

  // open brand task link
  function handleOpenBrandTaskLink(task: BrandTaskRow) {
    if (task.external_link) {
      window.open(task.external_link, "_blank");
    } else {
      router.push("/");
    }
  }

  // complete brand task (one-time per user)
  async function handleCompleteBrandTask(task: BrandTaskRow) {
    if (!user) {
      showToast("Please log in first.");
      return;
    }

    if (completedBrandTaskIds.includes(task.id)) {
      showToast("You already completed this brand task.");
      return;
    }

    setBrandTaskActionId(task.id);

    try {
      const { error: insertError } = await supabase
        .from("user_brand_tasks")
        .insert({
          user_id: user.id,
          task_id: task.id,
          reward_rupees: task.reward_rupees,
          reward_coins: 0,
        });
      if (insertError) {
        console.error(insertError);
        showToast("Could not complete brand task.");
        return;
      }
      await insertLedgerEntry({
        user_id: user.id,
        source_type: "brand_task",
        source_id: String(task.id),
        points: task.reward_rupees,
        weight: 2,
      });
      const newBalance = walletBalance + task.reward_rupees;

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

      setWalletBalance(Number(updated?.balance ?? newBalance));

      setCompletedBrandTaskIds((prev) => [...prev, task.id]);
      showToast(
        `Brand task completed. +₹${task.reward_rupees} added to wallet.`
      );
    } finally {
      setBrandTaskActionId(null);
    }
  }

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-[#050816] text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please log in to view your {BRAND.coinName} earnings and rupee
            wallet.
          </p>

          <a
            href="/auth"
            className="mt-4 inline-flex rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400"
          >
            Go to login →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 pb-14">
      {/* background gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-6 pb-4 sm:px-6">
        {/* header */}
        <header className="mb-6 flex items-center justify-between">
          <a
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200"
          >
            ← Back to home
          </a>
          <div className="text-right">
            <p className="text-[11px] text-slate-400">Genstrok wallet</p>
            <h1 className="text-lg font-semibold text-slate-50">
              {BRAND.coinName} & rupee balance
            </h1>
          </div>
        </header>

        {/* balances */}
        <section className="mb-4">
          <div
            className={
              "rounded-3xl border border-emerald-400/40 bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-sky-500/20 px-4 py-4 shadow-xl shadow-emerald-900/40 backdrop-blur flex items-center justify-between gap-4 transition-transform " +
              (coinPulse ? "scale-[1.03]" : "scale-100")
            }
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/80 shadow-inner shadow-black/50 text-2xl">
                ◎
              </div>
              <div>
                <p className="text-[11px] text-emerald-100">
                  Total {BRAND.coinName}
                </p>
                <p className="text-2xl font-bold tracking-tight text-emerald-50">
                  {totalCoins}
                </p>
                <p className="text-[11px] text-emerald-100/80">
                  Earned from claiming creator assets.
                </p>
              </div>
            </div>
            <div className="text-right text-[11px] text-emerald-100/80">
              <p>Own assets, level up, unlock perks.</p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 shadow-lg shadow-slate-950/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-400">
                  Rupee wallet balance
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-50">
                  ₹ {walletLoading ? "…" : walletBalance.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Use this balance to enter paid assets and unlock higher
                  rewards.
                </p>
              </div>
              <button
  type="button"
  onClick={() => showToast("Withdraw coming soon. KYC required.")}
  className="text-[11px] text-slate-400 underline"
>
  Withdraw money
</button>

              <div className="flex flex-col items-end gap-2">
                <p className="text-[10px] text-slate-500">
                   Add money to wallet 
                </p>
                <div className="flex gap-2">
                  {[10, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleRazorpayTopup(amt)}
      className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
    >
      +₹{amt}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-500">
  Secure payment via Razorpay
</p>
              </div>
            </div>
          </div>
        </section>

        {/* EARNING OPTIONS HUB */}
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-100">
            Earn on Genstrok
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            {/* Active: claim assets */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-50">
                  Claim creator assets
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Go to the home tab, claim free or paid assets, and earn{" "}
                  {BRAND.coinName} with every claim.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-3 inline-flex items-center justify-center rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-violet-400"
              >
                Go to assets feed
              </button>
            </div>

            {/* Daily missions */}

                {/* Daily missions & tasks card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-50">
                      Daily missions & tasks
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Simple app-based kaam for students and unemployed youth. Skill zero
                      chalega, bas time aur honesty chahiye.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/missions")}
                    className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    Open missions hub
                  </button>
                </div>


            {/* Brand tasks */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-50">
                  Brand & local tasks
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Do simple actions for brands and local shops and earn rupees
                  instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("brand-tasks");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="mt-3 inline-flex items-center justify-center rounded-full border border-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10"
              >
                View brand tasks below
              </button>
            </div>

            {/* Future: referrals */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 flex flex-col justify-between opacity-80">
              <div>
                <p className="text-xs font-semibold text-slate-50">
                  Referrals & streaks
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Earn by inviting friends and keeping daily streaks active.
                  Designed specially for students and youth – coming soon.
                </p>
              </div>
              <button

                 type="button"
                  onClick={() => router.push("/rewards")}
                  className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-700 px-3 py-1.5 text-[15px] font-semibold text-slate-100 hover:bg-slate-700"
                >
                Open growth hub
              </button>
            </div>
          </div>
        </section>





        {/* OWNED ASSETS – HOLD & RESELL */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Your owned assets (for resale)
            </h2>
            {listingsLoading && (
              <span className="text-[10px] text-slate-500">Loading…</span>
            )}
          </div>

          {ownedAssets.length === 0 ? (
            <p className="text-xs text-slate-400">
              You do not own any assets yet. Claim assets from the home tab,
              then you can put them on resale here.
            </p>
          ) : (
            <div className="space-y-2">
              {ownedAssets.map((asset) => {
                const listing = listingsByItem[asset.itemId];
                const isProcessing =
                  listingActionItemId === Number(asset.itemId);

                return (
                  <div
                    key={asset.itemId}
                    className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2 gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
                        {asset.cover_url ? (
                          <img
                            src={asset.cover_url}
                            alt={asset.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500">
                            No image
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-50 line-clamp-1">
                          {asset.title}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          {listing
                            ? `On sale for ₹${listing.ask_price}`
                            : "Not listed for resale"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {listing ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleCreateOrUpdateListing(asset.itemId)
                            }
                            disabled={isProcessing}
                            className="rounded-full border border-violet-500/70 px-3 py-1 text-[10px] font-semibold text-violet-300 hover:bg-violet-500/10 disabled:opacity-60"
                          >
                            {isProcessing ? "Updating…" : "Edit price"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelListing(asset.itemId)}
                            disabled={isProcessing}
                            className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                          >
                            {isProcessing ? "Cancelling…" : "Cancel resale"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleCreateOrUpdateListing(asset.itemId)
                          }
                          disabled={isProcessing}
                          className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {isProcessing ? "Listing…" : "Put on resale"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* CLAIM HISTORY */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Claim history
            </h2>
            {rows.length > 5 && (
              <button
                type="button"
                onClick={() => router.push("/history")}
                className="rounded-full border border-violet-500/70 px-3 py-1.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/10"
              >
                View full history
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-slate-400">
              You have not claimed any assets yet. Go to the home tab and claim
              your first asset to earn {BRAND.coinName}.
            </p>
          ) : (
            <div className="space-y-2">
              {visibleRows.map((row) => {
                const item = itemsById[String(row.item_id)];
                const title = item?.title || "Claimed asset";
                const coins = row.coins || 0;
                const date = new Date(row.created_at).toLocaleString();

                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-50 line-clamp-1">
                        {title}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">
                        Coins
                      </div>
                      <div className="text-sm font-semibold text-emerald-300">
                        +{coins}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-16 inset-x-0 flex justify-center z-50">
          <div className="rounded-full bg-slate-900/90 px-4 py-2 text-[11px] text-slate-100 border border-slate-700/70 shadow-lg shadow-black/60">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}