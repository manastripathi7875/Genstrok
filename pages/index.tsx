// pages/index.tsx

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router"; // âœ… NEW
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";
import { insertLedgerEntry } from "../lib/ledger";
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
  created_at?: string | null;
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

type EnrichedItem = ItemRow & {
  totalClaims: number;
  popularityScore: number;
  isNew: boolean;
  isEndingSoon: boolean;
  remaining: number; // clamped
};

export default function HomePage() {
  const router = useRouter(); 
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

  const [claimCounts, setClaimCounts] = useState<Record<number, number>>({});

// user
  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        window.location.replace("/landing"); 
        return;
      }
const { data: flag } = await supabase
  .from("user_flags")
  .select("first_mission_done")
  .eq("user_id", data.user.id)
  .single();

if (!flag || !flag.first_mission_done) {
  router.replace("/first-mission");
  return;
}
      setCurrentUser(data.user);
      setNeedsLogin(false);
    }
    checkAuth();
    if (!currentUser) return null;
  }, [ ]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

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
        .select(
          `
          id,
          title,
          price,
          stock,
          remaining,
          cover_url,
          creator_name,
          creator_user_id,
          is_paid,
          payment_link,
          coins_per_claim,
          is_published,
          created_at
        `
        )
        .order("created_at", { ascending: false })
        .limit(48);

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

  // enrich items
  const enrichedItems: EnrichedItem[] = useMemo(() => {
    const now = Date.now();

    return items.map((item) => {
      const totalClaims = claimCounts[item.id] || 0;

      let recencyBoost = 0;
      if (item.created_at) {
        const createdTime = new Date(item.created_at).getTime();
        const diffHours = (now - createdTime) / (1000 * 60 * 60);
        if (diffHours <= 24) recencyBoost = 20;
        else if (diffHours <= 72) recencyBoost = 10;
      }

      const popularityScore = totalClaims * 3 + recencyBoost;

      const stock = item.stock ?? 0;
      let remaining = item.remaining ?? stock;
      if (stock > 0 && remaining > stock) remaining = stock;
      if (remaining < 0) remaining = 0;

      const isEndingSoon =
        stock > 0 && remaining >= 0 && remaining / stock <= 0.2;

      const isNew =
        item.created_at &&
        (now - new Date(item.created_at).getTime()) /
          (1000 * 60 * 60) <=
          48;

      return {


        ...item,
        totalClaims,
        popularityScore,
        isNew: !!isNew,
        isEndingSoon,
        remaining,
      };
    });
  }, [items, claimCounts]);

  // sections
  const { featured, trending, newDrops, discover } = useMemo(() => {
    const sortedByScore = [...enrichedItems].sort(
      (a, b) => b.popularityScore - a.popularityScore
    );

    const featured = sortedByScore.slice(0, 2);
    const featuredIds = new Set(featured.map((i) => i.id));

    const trending = enrichedItems
      .filter(
        (i) =>
          !featuredIds.has(i.id) && i.totalClaims > 0 && i.popularityScore > 0
      )
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 8);

    const ftIds = new Set<number>([
      ...featuredIds,
      ...trending.map((i) => i.id),
    ]);

    const newDrops = enrichedItems
      .filter((i) => !ftIds.has(i.id) && i.isNew)
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8);

    const ftnIds = new Set<number>([
      ...ftIds,
      ...newDrops.map((i) => i.id),
    ]);

    const discover = enrichedItems
      .filter((i) => !ftnIds.has(i.id))
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8);

    return { featured, trending, newDrops, discover };
  }, [enrichedItems]);

  async function handleClaim(item: ItemRow) {
    if (!currentUser) {
      setNeedsLogin(true);
      return;
    }

    const stock = item.stock ?? 0;
    let left = item.remaining ?? stock;
    if (stock > 0 && left > stock) left = stock;
    if (left < 0) left = 0;

    if (!left || left <= 0) {
      setToast("This drop is sold out.");
      return;
    }

    const isPaidDrop = !!item.is_paid;
    const price = item.price || 0;

    if (isPaidDrop) {
      if (walletLoading) {
        setToast("Wallet is still loading. Please waitâ€¦");
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
console.log("ledger insert user", currentUser.id);
      await insertLedgerEntry({
        user_id: currentUser.id,
        source_type: "ownership",
        source_id: String(item.id), // force string
        points: coins,
      });

      if (ownError) {
        console.error("Ownership insert error", ownError);
        setToast("Error claiming this asset.");
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
        <div className="mx-auto w-full max-w-2xl space-y-5">
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

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-violet-600/40 via-indigo-600/30 to-sky-500/25 px-4 py-3 shadow-lg shadow-violet-900/40">
                <p className="text-[11px] text-slate-200">
                  Your total {BRAND.coinName}
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-300">
                  {claimsLoading ? "â€¦" : totalCoins}
                </p>
                <p className="mt-1 text-[10px] text-slate-300">
                  Own more assets to climb levels.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-4 py-3 shadow-lg shadow-slate-950/60 flex flex-col justify-between">
                <div>
                  <p className="text-[11px] text-slate-300">Wallet balance</p>
                  <p className="mt-1 text-xl font-semibold text-sky-300">
                    {walletLoading ? "â€¦" : walletBalance}
                  </p>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  Use balance to enter paid drops.
                </p>
              </div>
            </div>
          </section>

          {/* feed root */}
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Live asset marketplace
              </h2>
              <p className="text-[10px] text-slate-400">
                {items.length} active assets
              </p>
            </div>

            {itemsLoading ? (
              <p className="text-xs text-slate-400">Loading assetsâ€¦</p>
            ) : enrichedItems.length === 0 ? (
              <p className="text-xs text-slate-400">
                No assets yet. Add some from the admin panel.
              </p>
            ) : (
              <>
                {/* Featured horizontal rail */}
                {featured.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-200">
                        Featured and trending
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Highest activity right now
                      </p>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
                      {featured.map((item) => (
                        <div
                          key={item.id}
                          className="w-[68%] min-w-[68%] sm:w-[55%] sm:min-w-[55%]"
                        >
                          <DropCard
                            item={item}
                            owned={ownedIds.has(item.id)}
                            claimingId={claimingId}
                            onClaim={handleClaim}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending grid */}
                {trending.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-200">
                        Trending now
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Most claimed assets
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {trending.map((item) => (
                        <DropCard
                          key={item.id}
                          item={item}
                          owned={ownedIds.has(item.id)}
                          claimingId={claimingId}
                          onClaim={handleClaim}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* New drops */}
                {newDrops.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-200">
                        Fresh drops
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Added in last 48 hours
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {newDrops.map((item) => (
                        <DropCard
                          key={item.id}
                          item={item}
                          owned={ownedIds.has(item.id)}
                          claimingId={claimingId}
                          onClaim={handleClaim}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Discover lane */}
                {discover.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-200">
                        Discover more
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Hidden assets that need attention
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {discover.map((item) => (
                        <DropCard
                          key={item.id}
                          item={item}
                          owned={ownedIds.has(item.id)}
                          claimingId={claimingId}
                          onClaim={handleClaim}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {needsLogin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-950/95 p-4 text-[11px] text-slate-100 shadow-xl shadow-slate-900/80">
            <p className="mb-1 text-sm font-semibold">Login required</p>
            <p className="mb-3 text-[11px] text-slate-300">
              You need to log in to claim assets and earn {BRAND.coinName}.
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

function DropCard({
  item,
  owned,
  claimingId,
  onClaim,
}: {
  item: EnrichedItem;
  owned: boolean;
  claimingId: number | null;
  onClaim: (item: ItemRow) => void;
}) {
  const stock = item.stock ?? 0;
  let left = item.remaining;
  if (stock > 0 && left > stock) left = stock;
  if (left < 0) left = 0;

  const isPaid = !!item.is_paid;
  const price = item.price || 0;
  const coins = item.coins_per_claim || 10;

  const isTrending = item.totalClaims >= 3 && item.popularityScore >= 30;

  // price label: rupees for paid, "Free" for free
  const priceLabel = isPaid ? `â‚¹${price}` : "Free";

  // badges: max 2
  const badges: { key: string; label: string; emoji: string; className: string }[] = [];
  if (isTrending) {
    badges.push({
      key: "trending",
      label: "Trending",
      emoji: "ðŸ”¥",
      className: "bg-orange-500/90 text-slate-950",
    });
  }
  if (item.isEndingSoon) {
    badges.push({
      key: "ending",
      label: "Ending soon",
      emoji: "â³",
      className: "bg-amber-400/90 text-slate-950",
    });
  }
  if (item.isNew) {
    badges.push({
      key: "new",
      label: "New",
      emoji: "ðŸ†•",
      className: "bg-sky-500/90 text-slate-950",
    });
  }
  const limitedBadges = badges.slice(0, 2);

  const ownersText =
    item.totalClaims === 0
      ? "Be the first owner"
      : `${formatCount(item.totalClaims)} owners`;

  const leftText =
    stock === 0
      ? "Unlimited"
      : left <= 0
      ? "Sold out"
      : `${left} left`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-slate-950/60 snap-start">
      {/* image section */}
      <a href={`/drop/${item.id}`} className="block relative">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-900">
          {item.cover_url ? (
            <img
              src={item.cover_url}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500 text-xs">
              No image
            </div>
          )}

          {/* gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />

          {/* top badges */}
          {limitedBadges.length > 0 && (
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 text-[9px]">
              <div className="flex gap-1.5">
                {limitedBadges.map((b) => (
                  <span
                    key={b.key}
                    className={`rounded-full px-2 py-0.5 font-semibold ${b.className}`}
                  >
                    {b.emoji} {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* bottom creator strip */}
          <div className="absolute left-2 right-2 bottom-2 flex items-center justify-between gap-1 text-[9px] text-slate-200">
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[9px]">
                {(item.creator_name || "C").charAt(0).toUpperCase()}
              </div>
              <span className="truncate max-w-[100px]">
                {item.creator_name || "Creator"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {stock > 0 && (
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                  {leftText}
                </span>
              )}
              <span className="rounded-full bg-violet-600/80 px-2 py-0.5 font-semibold">
                {priceLabel}
              </span>
            </div>
          </div>
        </div>
      </a>

      {/* info + actions */}
      <div className="flex flex-1 flex-col px-2.5 pt-2 pb-2.5 space-y-1.5">
        <div className="flex items-start gap-1.5">
          <h3 className="flex-1 text-[12px] font-semibold leading-snug line-clamp-2">
            {item.title}
          </h3>
          {owned && (
            <span className="shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/60 px-2 py-0.5 text-[9px] text-emerald-200">
              Owned
            </span>
          )}
        </div>

        <div className="text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">ðŸ’Ž</span>
            <span className="truncate">
              {ownersText} Â· +{coins} {BRAND.coinName} Â· {leftText}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5">
            {isPaid ? "Paid asset" : "Reward asset"}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          <button
            onClick={() => onClaim(item)}
            disabled={claimingId === item.id || !left || left <= 0}
            className="flex-1 h-8 rounded-full bg-violet-600 text-[10px] font-semibold flex items-center justify-center shadow-lg shadow-violet-500/40 disabled:opacity-60"
          >
            {claimingId === item.id
              ? isPaid
                ? "Processingâ€¦"
                : "Claimingâ€¦"
              : !left || left <= 0
              ? "Sold out"
              : isPaid
              ? "Buy and claim"
              : "Claim ownership"}
          </button>
          <a
            href={`/drop/${item.id}`}
            className="h-8 px-3 rounded-full border border-slate-700 text-[10px] text-slate-300 flex items-center justify-center"
          >
            Details
          </a>
        </div>
      </div>
    </article>
  );
}