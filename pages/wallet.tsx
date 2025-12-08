// pages/wallet.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

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
};

export default function WalletPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [rows, setRows] = useState<OwnershipRow[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, ItemRow>>({});
  const [loading, setLoading] = useState(true);

  // rupee wallet state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [topupLoadingAmount, setTopupLoadingAmount] = useState<number | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);

  const [coinPulse, setCoinPulse] = useState(false);

  // 1) user + ownerships + wallet load
  useEffect(() => {
    async function load() {
      setLoading(true);
      setWalletLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setNeedsLogin(true);
        setLoading(false);
        setWalletLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);

      // a) ownerships (coins history)
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
            .select("id, title")
            .in("id", ids);

          if (!itemError && itemData) {
            const map: Record<string, ItemRow> = {};
            (itemData || []).forEach((it: any) => {
              map[it.id] = { id: it.id, title: it.title };
            });
            setItemsById(map);
          }
        }
      }

      setLoading(false);

      // b) rupee wallet load
      const { data: walletRow, error: walletError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (walletError && walletError.code !== "PGRST116") {
        // PGRST116 = row not found
        console.error(walletError);
        setWalletBalance(0);
        setWalletLoading(false);
        return;
      }

      if (!walletRow) {
        // wallet row create karo if missing
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

    load();
  }, []);

  // 2) Realtime coins update (ownerships)
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
              .select("id, title")
              .eq("id", newRow.item_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setItemsById((prev) => ({
                    ...prev,
                    [data.id]: { id: data.id, title: data.title },
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
      channel.unsubscribe();
    };
  }, [user, itemsById]);

  // 3) Total coins calculate
  const totalCoins = useMemo(
    () => rows.reduce((sum, r) => sum + (r.coins ? r.coins : 0), 0),
    [rows]
  );

  // 4) Simple toast helper
  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  // 5) TOP-UP handler (DEV MODE: direct add money)
  async function handleTopup(amount: number) {
    if (!user) {
      showToast("Please log in first.");
      return;
    }
    setTopupLoadingAmount(amount);

    try {
      // a) topup history me entry daalo
      const { error: insertError } = await supabase
        .from("wallet_topups")
        .insert({
          user_id: user.id,
          amount,
          status: "success",
          source: "dev-topup", // later: "cashfree"
        });

      if (insertError) {
        console.error(insertError);
        showToast("Could not add money.");
        return;
      }

      // b) wallet balance update karo
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

  // 6) Login required screen
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please log in to view your {BRAND.coinName} wallet and rupee
            balance.
          </p>

          <a
            href="/auth"
            className="mt-4 inline-flex rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400"
          >
            Go to Login →
          </a>
        </div>
      </div>
    );
  }

  // MAIN UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-14">
      {/* background gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-6 pb-4 sm:px-6">
        {/* top header */}
        <header className="mb-6 flex items-center justify-between">
          <a
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200"
          >
            ← Back to home
          </a>
          <div className="text-right">
            <p className="text-[11px] text-slate-400">
              {BRAND.name} wallet
            </p>
            <h1 className="text-lg font-semibold text-slate-50">
              {BRAND.coinName} & rupee balance
            </h1>
          </div>
        </header>

        {/* COINS BALANCE CARD */}
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
                  Earned from claims
                </p>
              </div>
            </div>
            <div className="text-right text-[11px] text-emerald-100/80"></div>
          </div>
        </section>

        {/* RUPEE WALLET CARD + TOP-UP */}
        <section className="mb-6">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 shadow-lg shadow-slate-950/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-400">
                  Rupee wallet balance
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-50">
                  ₹{" "}
                  {walletLoading ? "…" : walletBalance.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Use this balance to buy paid drops and unlock
                  future perks.
                </p>
              </div>

              {/* quick top-up buttons (DEV mode) */}
              <div className="flex flex-col items-end gap-2">
                <p className="text-[10px] text-slate-500">
                  Test add money
                </p>
                <div className="flex gap-2">
                  {[10, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleTopup(amt)}
                      disabled={topupLoadingAmount === amt}
                      className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60"
                    >
                      {topupLoadingAmount === amt
                        ? "Adding…"
                        : `+₹${amt}`}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-500">
                  Dev mode only - later this will use Cashfree.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CLAIM HISTORY */}
        <section>
          {/* clickable header to go to full history page */}
          <div
            className="mb-3 flex items-center justify-between cursor-pointer"
            onClick={() => router.push("/history")}
          >
            <h2 className="text-sm font-semibold text-slate-100">
              Claim history
            </h2>
            <span className="text-[11px] text-violet-400">
              View full history ›
            </span>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-slate-400">
              You have not claimed anything yet. Go to the home
              page and claim your first drop to earn coins.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const item = itemsById[row.item_id];
                const title = item?.title || "Claimed item";
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

      {/* simple toast */}
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