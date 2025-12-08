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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);

  const [viewerIdentity, setViewerIdentity] = useState("");
  const [search, setSearch] = useState("");

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

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
      setNeedsLogin(true);
      return;
    }

    if (!viewerIdentity.trim()) {
      setToast("Please enter your name or email first.");
      return;
    }

    if (!item.stock || item.stock <= 0) {
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

      const { error: ownError } = await supabase.from("ownerships").insert({
        item_id: item.id,
        buyer_id: currentUser.id,
        buyer_name: viewerIdentity.trim(),
        coins,
      });

      if (ownError) {
        console.error("Ownership insert error", ownError);
        setToast("Error claiming this drop.");
        return;
      }

      const newStock = (item.stock || 0) - 1;
      const { error: stockErr } = await supabase
        .from("items")
        .update({ stock: newStock })
        .eq("id", item.id);

      if (stockErr) {
        console.error(stockErr);
      }

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, stock: newStock } : it))
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
        setToast(`Claimed "${item.title}" +${coins} ${BRAND.coinName}!`);
      }
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 flex flex-col">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      {/* top bar */}
      <header className="relative z-20 sticky top-0 flex items-center justify-between px-4 py-3 bg-[#050816]/90 backdrop-blur border-b border-slate-900">
        <button className="h-10 w-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-lg">
          ☰
        </button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold tracking-wide">Genstrok</span>
          <span className="mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
            Powered by Protera
          </span>
        </div>

        <div className="flex items-center gap-2">
          <TopIcon>🔔</TopIcon>
          <TopIcon>🔎</TopIcon>
          <TopIcon>🤝</TopIcon>
        </div>
      </header>

      {/* main scroll */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {/* identity + wallet */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Live prototype v0.1
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  {BRAND.name} Home
                </p>
              </div>
              <a
                href="/wallet"
                className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-right text-[11px]"
              >
                <div className="text-[10px] text-slate-400">Wallet balance</div>
                <div className="text-xs font-semibold text-emerald-300">
                  {walletLoading ? "…" : `₹${walletBalance.toFixed(2)}`}
                </div>
              </a>
            </div>

            <div className="space-y-2 text-[11px]">
              <p className="text-slate-400">
                Your name or email for claim and coins
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
                    <span className="font-semibold">{currentLevel.name}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* search */}
          <section>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-900 bg-slate-950/80 px-4 py-3 text-[11px]">
              <span className="text-slate-500">🔍</span>
              <input
                className="flex-1 bg-transparent text-[11px] text-slate-100 outline-none"
                placeholder="Search drops by title or creator"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </section>

          {/* feed */}
          <section className="pb-2">
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
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <article
                    key={item.id}
                    className="bg-slate-900/70 border border-slate-800 rounded-3xl p-3 space-y-3 shadow-lg shadow-slate-950/60"
                  >
                    {/* thumbnail */}
                    <div className="relative overflow-hidden rounded-2xl h-48">
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

                      <div className="absolute left-2 top-2 flex gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-950/80 text-slate-50 border border-slate-700">
                          ₹{item.price}
                        </span>
                        {item.is_paid && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-amber-950">
                            Paid drop
                          </span>
                        )}
                      </div>

                      <div className="absolute right-2 top-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/90 text-emerald-950">
                          Stock {item.stock}
                        </span>
                      </div>

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#050816]/90 to-transparent" />
                    </div>

                    {/* title + creator */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                            {item.title}
                          </h3>
                          <button className="shrink-0 text-slate-500 text-lg px-1">
                            ⋮
                          </button>
                        </div>
                        <div className="mt-2 flex items-center text-[11px] text-slate-400 gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[9px]">
                            {item.creator_name
                              ? item.creator_name.charAt(0).toUpperCase()
                              : "C"}
                          </div>
                          <span className="truncate max-w-[140px]">
                            {item.creator_name || "Creator"}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-500" />
                          <span>Drop</span>
                        </div>
                      </div>
                    </div>

                    {/* VIEWS / LIKES / CLAIMS row (UI only, static for now) */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <Stat label="VIEWS" value="3.2M" icon="👁" />
                      <Stat label="LIKES" value="22K" icon="★" />
                      <Stat label="CLAIMS" value="3.1K" icon="💎" />
                    </div>

                    {/* Stock / coins / price row */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <Stat
                        label="STOCK LEFT"
                        value={String(item.stock)}
                        icon="📦"
                      />
                      <Stat
                        label={BRAND.coinName.toUpperCase()}
                        value={`+${item.coins_per_claim || 10}`}
                        icon="💠"
                      />
                      <Stat
                        label="PRICE"
                        value={item.is_paid ? `₹${item.price}` : "Free"}
                        icon="💰"
                      />
                    </div>

                    {/* actions */}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleClaim(item)}
                        disabled={claimingId === item.id}
                        className="flex-1 h-10 rounded-full bg-violet-600 text-xs font-semibold flex items-center justify-center shadow-lg shadow-violet-500/40 disabled:opacity-60"
                      >
                        {claimingId === item.id
                          ? item.is_paid
                            ? "Processing…"
                            : "Claiming…"
                          : item.is_paid
                          ? "Buy and claim"
                          : "Claim ownership"}
                      </button>
                      <button className="h-10 px-4 rounded-full border border-slate-700 text-[11px] text-slate-300">
                        View details
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-1">
                      Earn {item.coins_per_claim || 10} {BRAND.coinName} per
                      claim
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-[#050816]/95 backdrop-blur px-4 py-2">
        <div className="flex items-center justify-between">
          <BottomNavItem label="Home" active>
            🏠
          </BottomNavItem>
          <BottomNavItem label="Work">
            💼
          </BottomNavItem>
          <button className="h-12 w-12 rounded-full bg-violet-600 text-white flex items-center justify-center text-2xl -mt-6 shadow-xl shadow-violet-500/50">
            +
          </button>
          <BottomNavItem label="Creators">
            👥
          </BottomNavItem>
          <BottomNavItem label="Top">
            🏆
          </BottomNavItem>
        </div>
      </nav>

      {/* login popup */}
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

      {/* toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4">
          <div className="max-w-sm rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 shadow-lg shadow-emerald-900/40">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

/* small components */

function TopIcon({ children }: { children: React.ReactNode }) {
  return (
    <button className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-base">
      {children}
    </button>
  );
}

function BottomNavItem({
  children,
  label,
  href,
  active,
}: {
  children: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
}) {
  const contents = (
    <>
      <div
        className={
          "h-8 w-8 rounded-full flex items-center justify-center text-lg " +
          (active
            ? "bg-violet-600 text-white"
            : "bg-slate-900 text-slate-400 border border-slate-800")
        }
      >
        {children}
      </div>
      <span
        className={
          "text-[11px] " +
          (active ? "text-slate-50 font-medium" : "text-slate-400")
        }
      >
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className="flex flex-col items-center gap-0.5 flex-1">
        {contents}
      </a>
    );
  }

  return (
    <button className="flex flex-col items-center gap-0.5 flex-1">
      {contents}
    </button>
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