import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type ItemRow = {
  id: string;
  title: string;
  price: number;
  stock: number;
  cover_url: string | null;
  creator_name: string | null;
  creator_id: string | null;
  is_paid?: boolean | null;
  payment_link?: string | null;
  coins_per_claim?: number | null;
};

type ClaimRow = {
  id: string;
  created_at: string;
  item_id: string;
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

export default function HomePage() {
  const [currentUser, setCurrentUser] = 
  useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);

  const [viewerIdentity, setViewerIdentity] = useState("");
  const [search, setSearch] = useState("");

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // auto hide toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  // load user
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

  // load items
  useEffect(() => {
    async function loadItems() {
      setItemsLoading(true);
      const { data, error } = await supabase
        .from("items")
        .select(
          "id, title, price, stock, cover_url, creator_name, creator_id, is_paid, payment_link, coins_per_claim"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setItems([]);
      } else {
        setItems((data || []) as ItemRow[]);
      }
      setItemsLoading(false);
    }
    loadItems();
  }, []);

  // load current user's claims
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
        .select(
          "id, created_at, item_id, buyer_id, buyer_name, coins"
        )
        .eq("buyer_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setClaims([]);
      } else {
        setClaims((data || []) as ClaimRow[]);
      }
      setClaimsLoading(false);
    }
    loadClaims();
  }, [currentUser]);

  const totalCoins = useMemo(
    () => claims.reduce((sum, c) => sum + (c.coins || 0), 0),
    [claims]
  );
  const currentLevel = useMemo(
    () => getLevelFromCoins(totalCoins),
    [totalCoins]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const t = it.title?.toLowerCase() || "";
      const c = it.creator_name?.toLowerCase() || "";
      return t.includes(q) || c.includes(q);
    });
  }, [items, search]);

  async function handleClaim(item: ItemRow) {
    if (!currentUser) {
      setToast("Please log in to claim drops.");
      return;
    }
    if (!viewerIdentity.trim()) {
      setNeedsLogin(true);
      return;
    }
    if (!item.stock || item.stock <= 0) {
      setToast("This drop is sold out.");
      return;
    }

    // Paid drop → open Cashfree payment link
    if (item.is_paid) {
      if (!item.payment_link) {
        setToast("Payment link not configured for this paid drop.");
        return;
      }

      if (typeof window !== "undefined") {
        window.open(item.payment_link, "_blank");
        const ok = window.confirm(
          "Cashfree payment page open ho gaya hai. Jab payment complete kar lo, tab yahan OK dabao taki claim & coins mil sake."
        );
        if (!ok) return;
      }
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

      // 1) insert ownership row
      const { error: ownError } = await supabase
        .from("ownerships")
        .insert({
          item_id: item.id,
          buyer_id: currentUser.id,
          buyer_name: viewerIdentity.trim(),
          coins,
        });

      if (ownError) {
        console.error(ownError);
        setToast("Error claiming this drop.");
        return;
      }

      // 2) stock - 1 in DB
      const newStock = (item.stock || 0) - 1;
      const { error: stockErr } = await supabase
        .from("items")
        .update({ stock: newStock })
        .eq("id", item.id);

      if (stockErr) {
        console.error(stockErr);
      }

      // 3) update local UI
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, stock: newStock } : it
        )
      );
      setClaims((prev) => [
        {
          id: Math.random().toString(36).slice(2),
          created_at: new Date().toISOString(),
          item_id: item.id,
          buyer_id: currentUser.id,
          buyer_name: viewerIdentity.trim(),
          coins,
        },
        ...prev,
      ]);

      const newTotal = prevCoins + coins;
      const newLevel = getLevelFromCoins(newTotal);

      if (newLevel.name !== prevLevel.name) {
        setToast(
          `Level up! You are now ${newLevel.name} (${newTotal} ${BRAND.coinName}).`
        );
      } else {
        setToast(
          `Claimed "${item.title}" +${coins} ${BRAND.coinName}!`
        );
      }
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-16">
      {/* soft gradient bg */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-5 pb-10 sm:px-6">
        {/* top nav */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Live prototype • v0.1
            </p>
            <h1 className="text-xl font-semibold text-slate-50">
              {BRAND.name} Market
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[11px]">

          </div>
        </header>

        {/* identity + level card */}
        <section className="mb-4 space-y-3">
          <div className="space-y-1 text-[11px]">
            <p className="text-slate-400">
              Your name / email for claim & coins
            </p>
            <input
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-100 outline-none focus:border-violet-500"
              placeholder="Your name or email"
              value={viewerIdentity}
              onChange={(e) => setViewerIdentity(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 text-[11px] sm:flex-row">
            <div className="flex-1 rounded-3xl border border-slate-800 bg-gradient-to-r from-violet-600/40 via-indigo-600/30 to-sky-500/25 px-4 py-3 shadow-lg shadow-violet-900/40">
              <p className="text-[11px] text-slate-200">
                Your total {BRAND.coinName}
              </p>
              <div className="mt-1 flex items-baseline justify-between">
                <p className="text-2xl font-semibold text-emerald-300">
                  {claimsLoading ? "…" : totalCoins}
                </p>
                <p className="text-[11px] text-slate-300">
                  Level:{" "}
                  <span className="font-semibold">
                    {currentLevel.name}
                  </span>
                </p>
              </div>
  
            </div>
          </div>
        </section>

        {/* search bar */}
        <section className="mb-4">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-900 bg-slate-950/80 px-5 py-4 text-[1px]">
            <span className="text-slate-500">🔍</span>
            <input
              className="flex-1 bg-transparent text-[11px] text-slate-100 outline-none"
              placeholder="Search drops by title or creator…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </section>

        {/* items grid */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-100">
            Live drops
          </h2>

          {itemsLoading ? (
            <p className="text-xs text-slate-400">Loading drops…</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs text-slate-400">
              No drops yet. Add some from the admin panel.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/90 shadow-lg shadow-slate-950/70"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-slate-900">
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        No image
                      </div>
                    )}
                    <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-slate-50">
                      ₹{item.price}
                    </div>
                    <div className="absolute right-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] text-emerald-950">
                      Stock: {item.stock}
                    </div>
                    {item.is_paid && (
                      <div className="absolute left-2 bottom-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] text-amber-950">
                        Paid drop
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 px-3 py-3 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-50">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">
                          by {item.creator_name || "Creator"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] text-slate-400">
                        +{item.coins_per_claim || 10}{" "}
                        {BRAND.coinName} per claim
                      </p>
                      <button
                        onClick={() => handleClaim(item)}
                        disabled={claimingId === item.id}
                        className="rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
                      >
                        {claimingId === item.id
                          ? "Claiming…"
                          : "Claim ownership"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
{/* Login required popup */}
      {needsLogin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-950/95 p-4 text-[11px] text-slate-100 shadow-xl shadow-slate-900/80">
            <p className="text-sm font-semibold mb-1">
              Login required
            </p>
            <p className="text-[11px] text-slate-300 mb-3">
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
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-4">
          <div className="max-w-sm rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 shadow-lg shadow-emerald-900/40">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}