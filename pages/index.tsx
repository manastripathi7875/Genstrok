// pages/index.tsx

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type ItemRow = {
  id: number;
  title: string;
  price?: number | null;
  stock?: number | null;
  remaining?: number | null;
  cover_url?: string | null;
  creator_name?: string | null;
  creator_user_id?: string | null;
  is_paid?: boolean | null;
  payment_link?: string | null;
  coins_per_claim?: number | null;
  is_published?: boolean | null;
};

type ClaimRow = {
  id: string;
  created_at: string;
  item_id: number;
  buyer_id: string;
  buyer_name: string | null;
  coins: number | null;
};

type LevelDef = {
  name: string;
  min: number;
};

const LEVELS: LevelDef[] = [
  { name: "Bronze", min: 0 },
  { name: "Silver", min: 50 },
  { name: "Gold", min: 200 },
  { name: "Platinum", min: 500 },
  { name: "Diamond", min: 1000 },
];

function getLevelFromCoins(coins: number): LevelDef {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (coins >= lvl.min) current = lvl;
  }
  return current;
}

function formatCount(n: number | null | undefined): string {
  const num = n || 0;
  if (num >= 1_000_000)
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000)
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(num);
}

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);

  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState<boolean>(true);

  // total claims per drop
  const [claimCounts, setClaimCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  // user
  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setCurrentUser(null);
        setNeedsLogin(true);
        return;
      }
      setCurrentUser(data.user);
      setNeedsLogin(false);
    }
    loadUser();
  }, []);

  // wallet
  useEffect(() => {
    async function loadWallet() {
      if (!currentUser) {
        setWalletBalance(0);
        setWalletLoading(false);
        return;
      }

      setWalletLoading(true);

      const { data, error } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error && (error as any).code !== "PGRST116") {
        console.error("Wallet load error", error);
        setWalletBalance(0);
        setWalletLoading(false);
        return;
      }

      if (!data) {
        const { data: created, error: createErr } = await supabase
          .from("wallets")
          .insert({ user_id: currentUser.id, balance: 0 })
          .select("balance")
          .maybeSingle();

        if (createErr) {
          console.error("Wallet create error", createErr);
          setWalletBalance(0);
        } else {
          setWalletBalance(Number(created?.balance ?? 0));
        }
      } else {
        setWalletBalance(Number((data as any).balance ?? 0));
      }

      setWalletLoading(false);
    }

    loadWallet();
  }, [currentUser]);

  // items
  useEffect(() => {
    async function loadItems() {
      setItemsLoading(true);
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("items error", error);
        setItems([]);
      } else {
        const raw = (data || []) as any[];
        const publishedOnly = raw.filter(
          (row) =>
            row.is_published === true ||
            typeof row.is_published === "undefined"
        );
        setItems(publishedOnly as ItemRow[]);
      }
      setItemsLoading(false);
    }
    loadItems();
  }, []);

  // current user claims
  useEffect(() => {
    async function loadClaims() {
      if (!currentUser) {
        setClaims([]);
        setClaimsLoading(false);
        return;
      }
      setClaimsLoading(true);
      const { data, error } = await supabase
        .from("ownerships")
        .select("id, created_at, item_id, buyer_id, buyer_name, coins")
        .eq("buyer_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("claims error", error);
        setClaims([]);
      } else {
        setClaims((data || []) as any as ClaimRow[]);
      }
      setClaimsLoading(false);
    }
    loadClaims();
  }, [currentUser]);

  // total claims per drop
  useEffect(() => {
    async function loadClaimCounts() {
      const { data, error } = await supabase
        .from("ownerships")
        .select("item_id");

      if (error) {
        console.error("Claim counts error", error);
        return;
      }

      const map: Record<number, number> = {};
      (data as { item_id: number }[]).forEach((row) => {
        map[row.item_id] = (map[row.item_id] || 0) + 1;
      });
      setClaimCounts(map);
    }
    loadClaimCounts();
  }, []);

  const totalCoins = useMemo(
    () => claims.reduce((sum, c) => sum + (c.coins || 0), 0),
    [claims]
  );
  const currentLevel = useMemo(
    () => getLevelFromCoins(totalCoins),
    [totalCoins]
  );

  const ownedIds = useMemo(
    () => new Set(claims.map((c) => c.item_id)),
    [claims]
  );

  async function handleClaim(item: ItemRow) {
    if (!currentUser) {
      setNeedsLogin(true);
      return;
    }

    const stock = item.stock ?? 0;
    const left = item.remaining ?? stock;
    if (!left || left <= 0) {
      setToast("This drop is sold out.");
      return;
    }

    const isPaidDrop = !!item.is_paid;
    const price = item.price || 0;

    if (isPaidDrop) {
      if (walletLoading) {
        setToast("Wallet is still loading. Please wait…");
        return;
      }

      if (walletBalance < price) {
        setToast(
          "Not enough wallet balance. Go to Wallet tab and add money first."
        );
        return;
      }

      const newBalance = walletBalance - price;

      const { data: updated, error: walletErr } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("user_id", currentUser.id)
        .select("balance")
        .maybeSingle();

      if (walletErr) {
        console.error("Wallet update error", walletErr);
        setToast("Wallet update failed. Please try again.");
        return;
      }

      setWalletBalance(
        Number(
          updated && (updated as any).balance != null
            ? (updated as any).balance
            : newBalance
        )
      );
    }

    setClaimingId(item.id);
    setToast(null);

    try {
      const coins =
        item.coins_per_claim && item.coins_per_claim > 0
          ? item.coins_per_claim
          : 10;

      const prevCoins = totalCoins;
      const prevLevel = getLevelFromCoins(prevCoins);

      const buyerName =
        currentUser.user_metadata?.full_name ||
        currentUser.email ||
        currentUser.id;

      const { error: ownError } = await supabase.from("ownerships").insert({
        item_id: item.id,
        buyer_id: currentUser.id,
        buyer_name: buyerName,
        coins,
      });

      if (ownError) {
        console.error("Ownership insert error", ownError);
        setToast("Error claiming this drop.");
        return;
      }

      const newRemaining = left - 1;
      const { error: stockErr } = await supabase
        .from("items")
        .update({ remaining: newRemaining })
        .eq("id", item.id);

      if (stockErr) {
        console.error("remaining update error", stockErr);
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, remaining: newRemaining } : it
        )
      );

      setClaims((prev) => [
        {
          id: Math.random().toString(36).slice(2),
          created_at: new Date().toISOString(),
          item_id: item.id,
          buyer_id: currentUser.id,
          buyer_name: buyerName,
          coins,
        },
        ...prev,
      ]);

      setClaimCounts((prev) => ({
        ...prev,
        [item.id]: (prev[item.id] || 0) + 1,
      }));

      const newTotal = prevCoins + coins;
      const newLevel = getLevelFromCoins(newTotal);

      if (newLevel.name !== prevLevel.name) {
        setToast(
          `Level up! You are now ${newLevel.name} (${newTotal} ${BRAND.coinName}).`
        );
      } else {
        setToast(`Claimed "${item.title}" +${coins} ${BRAND.coinName}!`);
      }
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 flex flex-col">
      {/* subtle bg */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <main className="relative z-10 flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {/* top summary */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Genstrok
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Creator ownership home
                </p>
              </div>
              <div className="text-right text-[11px]">
                <p className="text-[10px] text-slate-400">Level</p>
                <p className="text-xs font-semibold text-emerald-300">
                  {currentLevel.name}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 text-[11px] sm:flex-row">
              <div className="flex-1 rounded-3xl border border-slate-800 bg-gradient-to-r from-violet-600/40 via-indigo-600/30 to-sky-500/25 px-4 py-3 shadow-lg shadow-violet-900/40">
                <p className="text-[11px] text-slate-200">
                  Your total {BRAND.coinName}
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-300">
                  {claimsLoading ? "…" : totalCoins}
                </p>
              </div>
            </div>
          </section>

          {/* search section removed intentionally – global search icon opens /searchbar */}

          {/* feed */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-100">
              Live drops
            </h2>

            {itemsLoading ? (
              <p className="text-xs text-slate-400">Loading drops…</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-slate-400">
                No drops yet. Add some from the admin panel.
              </p>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const totalClaims = claimCounts[item.id] || 0;
                  const owned = ownedIds.has(item.id);
                  const stock = item.stock ?? 0;
                  const left = item.remaining ?? stock;

                  return (
                    <article
                      key={item.id}
                      className="bg-slate-900/70 border border-slate-800 rounded-3xl p-3 space-y-3 shadow-lg shadow-slate-950/60"
                    >
                      {/* thumbnail */}
                      <a
                        href={`/drop/${item.id}`}
                        className="block overflow-hidden rounded-2xl h-48"
                      >
                        {item.cover_url ? (
                          <img
                            src={item.cover_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-900 text-xs text-slate-500">
                            No image
                          </div>
                        )}
                      </a>

                      {/* title + creator */}
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                              {item.title}
                            </h3>
                            {owned && (
                              <span className="shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/60 px-2 py-0.5 text-[9px] text-emerald-200">
                                Owned
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center text-[11px] text-slate-400 gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[9px]">
                              {(item.creator_name || "C")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <span className="truncate max-w-[140px]">
                              {item.creator_name || "Creator"}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-slate-500" />
                            <span>Drop</span>
                          </div>
                        </div>
                      </div>

                      {/* stats */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <Stat label="VIEWS" value="3.2M" icon="👁" />
                        <Stat label="LIKES" value="22K" icon="★" />
                        <Stat
                          label="CLAIMS"
                          value={formatCount(totalClaims)}
                          icon="💎"
                        />
                      </div>

                      {/* CTAs */}
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => handleClaim(item)}
                          disabled={claimingId === item.id || !left || left <= 0}
                          className="flex-1 h-10 rounded-full bg-violet-600 text-xs font-semibold flex items-center justify-center shadow-lg shadow-violet-500/40 disabled:opacity-60"
                        >
                          {claimingId === item.id
                            ? item.is_paid
                              ? "Processing…"
                              : "Claiming…"
                            : !left || left <= 0
                            ? "Sold out"
                            : item.is_paid
                            ? "Buy and claim"
                            : "Claim ownership"}
                        </button>
                        <a
                          href={`/drop/${item.id}`}
                          className="h-10 px-4 rounded-full border border-slate-700 text-[11px] text-slate-300 flex items-center justify-center"
                        >
                          View details
                        </a>
                      </div>

                      <p className="text-[10px] text-slate-500 mt-1">
                        Stock left{" "}
                        <span className="font-semibold text-slate-200">
                          {left} / {stock}
                        </span>
                        {" • "}
                        Earn {item.coins_per_claim || 10} {BRAND.coinName} per
                        claim
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {needsLogin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-950/95 p-4 text-[11px] text-slate-100 shadow-xl shadow-slate-900/80">
            <p className="mb-1 text-sm font-semibold">Login required</p>
            <p className="mb-3 text-[11px] text-slate-300">
              You need to log in to claim drops and earn {BRAND.coinName}.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNeedsLogin(false)}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-[11px] text-slate-200"
              >
                Not now
              </button>
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/auth";
                  }
                }}
                className="rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-violet-400"
              >
                Login now
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="max-w-sm rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 shadow-lg shadow-emerald-900/40">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs">{icon}</span>
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
      <span className="text-[11px] text-slate-200 font-medium">{value}</span>
    </div>
  );
}