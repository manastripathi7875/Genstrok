import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type Item = {
  id: string;
  title: string;
  price: number;
  cover_url: string | null;
  stock: number;
  creator_name?: string | null;
};

function getLevel(coins: number): string {
  if (coins >= 1000) return "Diamond";
  if (coins >= 500) return "Gold";
  if (coins >= 200) return "Silver";
  if (coins >= 50) return "Bronze";
  return "Starter";
}

type ToastType = "success" | "error" | "info";

type ToastState = {
  message: string;
  type: ToastType;
};

type NavKey = "home" | "wallet" | "creators" | "leaderboard";

type Stats = {
  drops: number;
  creators: number;
  claims: number;
  coinsIssued: number;
};

function BottomNav({ active }: { active: NavKey }) {
  const base =
    "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px]";
  const itemClass = (key: NavKey) =>
    base +
    " " +
    (active === key
      ? "text-violet-300"
      : "text-slate-500 hover:text-slate-200");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/96 backdrop-blur">
      <div className="mx-auto flex max-w-5xl px-8 py-2.5">
        <a href="/" className={itemClass("home")}>
          <span className="text-base">⌂</span>
          <span>Home</span>
        </a>
        <a href="/wallet" className={itemClass("wallet")}>
          <span className="text-base">◎</span>
          <span>Wallet</span>
        </a>
        <a href="/creators" className={itemClass("creators")}>
          <span className="text-base">👤</span>
          <span>Creators</span>
        </a>
        <a
          href="/leaderboard"
          className={itemClass("leaderboard")}
        >
          <span className="text-base">🏆</span>
          <span>Top</span>
        </a>
        <a
          href="/creator-dashboard"
          className="flex flex-col items-center justify-center gap-0.5 text-xs text-slate-400"
        >
          <span className="text-lg">📊</span>
          <span>Creator</span>
        </a>
      </div>
    </nav>
  );
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [inlineMsg, setInlineMsg] = useState("");
  const [coinsTotal, setCoinsTotal] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<
    "new" | "price-high" | "price-low" | "stock-low"
  >("new");
  const [stats, setStats] = useState<Stats | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [levelPulse, setLevelPulse] = useState(false);
  const lastLevelRef = useRef<string | null>(null);

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }

  function getToastClasses(type: ToastType): string {
    const base =
      "rounded-full px-4 py-2 text-xs font-medium shadow-xl backdrop-blur border flex items-center gap-2";
    if (type === "success") {
      return (
        base +
        " bg-emerald-500/95 border-emerald-200 text-emerald-950"
      );
    }
    if (type === "error") {
      return (
        base + " bg-red-500/95 border-red-200 text-red-950"
      );
    }
    return (
      base + " bg-slate-900/95 border-slate-600 text-slate-50"
    );
  }

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      setErrorText(error.message);
      showToast("Error loading items", "error");
    } else {
      setItems((data || []) as Item[]);
      setErrorText("");
    }
    setLoading(false);
  }

  async function fetchCoinsForBuyer(name: string) {
    const clean = name.trim();
    if (!clean) {
      setCoinsTotal(null);
      return;
    }

    const { data, error } = await supabase
      .from("ownerships")
      .select("coins")
      .eq("buyer_name", clean);

    if (error) {
      console.log("coins error", error);
      return;
    }

    const total = (data || []).reduce(
      (sum: number, row: any) => sum + (row.coins ?? 0),
      0
    );
    setCoinsTotal(total);
  }

  async function fetchStats() {
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select("id, creator_name");

      if (itemsError) throw itemsError;

      const { data: ownsData, error: ownsError } = await supabase
        .from("ownerships")
        .select("buyer_name, coins");

      if (ownsError) throw ownsError;

      const drops = (itemsData || []).length;

      const creatorsSet = new Set(
        (itemsData || [])
          .map((row: any) => (row.creator_name || "").trim())
          .filter((x: string) => x)
      );

      const claims = (ownsData || []).length;

      const coinsIssued = (ownsData || []).reduce(
        (sum: number, row: any) => sum + (row.coins ?? 0),
        0
      );

      setStats({
        drops,
        creators: creatorsSet.size,
        claims,
        coinsIssued,
      });
    } catch (err) {
      console.log("stats error", err);
    }
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        // Privacy: do NOT auto-show email in input on home
      }
      fetchItems();
      fetchStats();
    }
    init();
  }, []);

  // level-up animation trigger
  useEffect(() => {
    if (coinsTotal === null) return;
    const levelNow = getLevel(coinsTotal);
    const prev = lastLevelRef.current;
    if (!prev) {
      lastLevelRef.current = levelNow;
      return;
    }
    if (prev !== levelNow) {
      showToast(`Level up: ${prev} → ${levelNow}`, "success");
      setLevelPulse(true);
      setTimeout(() => setLevelPulse(false), 1200);
      lastLevelRef.current = levelNow;
    }
  }, [coinsTotal]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setBuyerName("");
    setCoinsTotal(null);
    setInlineMsg("Logged out.");
    showToast("Logged out of Genstrok", "info");
  }

  async function handleClaim(item: Item) {
    if (!buyerName.trim()) {
      const msg = "Please enter your name / email first.";
      setInlineMsg(msg);
      showToast(msg, "error");
      return;
    }
    if (!item.stock || item.stock <= 0) {
      const msg = "This item is out of stock.";
      setInlineMsg(msg);
      showToast(msg, "error");
      return;
    }

    setInlineMsg("Processing claim…");
    showToast("Processing your claim…", "info");

    const coinsEarned = Math.max(
      1,
      Math.round((item.price || 0) / 100)
    );
    const cleanName = buyerName.trim();
// agar user logged in hai to id use karo, warna null
const buyerId = user?.id ?? null;
    const { error: ownError } = await supabase.from("ownerships").insert([
      {
        item_id: item.id,
        buyer_name: cleanName,
        coins: coinsEarned,
        buyer_id: buyerId,   // 👈 YE NAYA FIELD
      },
    ]);

    if (ownError) {
      console.log(ownError);
      const msg =
        "Error saving ownership: " + ownError.message;
      setInlineMsg(msg);
      showToast("Claim failed", "error");
      return;
    }

    const { error: updError } = await supabase
      .from("items")
      .update({ stock: (item.stock || 0) - 1 })
      .eq("id", item.id);

    if (updError) {
      console.log(updError);
      const msg =
        "Ownership saved, but stock update failed.";
      setInlineMsg(msg);
      showToast("Stock update failed", "error");
    } else {
      const successMsg = `Claimed: ${item.title} • +${coinsEarned} ${BRAND.coinName}`;
      setInlineMsg(successMsg);
      showToast(successMsg, "success");
      fetchItems();
      fetchCoinsForBuyer(cleanName);
      fetchStats();
    }
  }

  const userLevel =
    coinsTotal !== null ? getLevel(coinsTotal) : null;

  const visibleItems = (() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = items.filter((item) => {
      if (!q) return true;
      const title = (item.title || "").toLowerCase();
      const creator = (item.creator_name || "").toLowerCase();
      return title.includes(q) || creator.includes(q);
    });

    const sorted = [...filtered];

    switch (sortMode) {
      case "price-high":
        sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "price-low":
        sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "stock-low":
        sorted.sort((a, b) => (a.stock || 0) - (b.stock || 0));
        break;
      case "new":
      default:
        // already newest first from query
        break;
    }

    return sorted;
  })();

  const iconBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/70 bg-slate-950/80 text-[14px] text-slate-100 hover:border-slate-500";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-12">
      {/* gradient bg */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-16 z-50 flex justify-center px-4">
          <div className={getToastClasses(toast.type)}>
            <span className="text-[13px] leading-none">
              {toast.message}
            </span>
          </div>
        </div>
      )}

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-4 pt-4 sm:px-6">
        {/* top bar */}
        {/*
        <header className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950/80 ring-1 ring-slate-700/60">
              <span className="text-lg font-bold tracking-tight">
                {BRAND.short}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">
                  {BRAND.name} Market
                </span>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-semibold text-slate-300 border border-slate-700/60">
                  Beta
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {BRAND.tagline}
              </div>
            </div>
          </div>

            <div className="flex items-center gap-2">
              <NotificationBell
                userEmail={user?.email || null}
                userId={user?.id || null}
              />
            <a href="/history" className={iconBtn}>
              🕘
            </a>
            <a href="/admin" className={iconBtn}>
              🛠
            </a>
            {!user ? (
              <a href="/auth" className={iconBtn}>
                👤
              </a>
            ) : (
              <a href="/creators" className={iconBtn}>
                👤
              </a>
            )}
            {user && (
              <button 
                onClick={handleLogout}
                className={iconBtn + " hidden sm:inline-flex"}
              >
                ⏏
              </button>
            )}
          </div>
        </header>
*/}
        {/* hero + user panel + search */}
        <section className="mb-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live prototype • v0.1
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)]">
            <div className="space-y-2">
              
              
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-3 shadow-sm shadow-slate-950/70 backdrop-blur">
                <label className="text-[11px] font-medium text-slate-300">
                  Your name / email for claim & coins
                </label>
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  onBlur={() => fetchCoinsForBuyer(buyerName)}
                  placeholder="you@email.com or @handle"
                  className="input-primary"
                />

                {inlineMsg && (
                  <p className="mt-2 text-[11px] text-slate-300">
                    {inlineMsg}
                  </p>
                )}

                {coinsTotal !== null && (
                  <p className="mt-1 text-[11px] text-emerald-300">
                    Total {BRAND.coinName}:{" "}
                    <span className="font-semibold">
                      {coinsTotal}
                    </span>
                  </p>
                )}
              </div>

              {userLevel && (
                <div
                  className={
                    "rounded-2xl border border-violet-500/50 bg-gradient-to-r from-violet-600/30 via-indigo-600/25 to-sky-600/25 p-4 shadow-lg shadow-violet-900/40 backdrop-blur flex items-center gap-3 transition " +
                    (levelPulse
                      ? "scale-[1.02] ring-2 ring-violet-400/70"
                      : "scale-100")
                  }
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-inner shadow-black/40 text-lg font-bold">
                    ⚡
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] text-slate-200">
                      Your {BRAND.name} level
                    </p>
                    <p className="text-lg font-bold text-white tracking-tight">
                      {userLevel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-200">
                      Coins
                    </p>
                    <p className="text-base font-semibold text-violet-100">
                      {coinsTotal ?? 0}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* search + sort row */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/80 px-3 py-2 shadow-sm shadow-slate-950/60 backdrop-blur">
              <span className="text-sm text-slate-400">🔍</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drops by title or creator…"
                className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 shadow-sm shadow-slate-950/60 backdrop-blur md:w-[190px]">
              <span>Sort</span>
              <select
                value={sortMode}
                onChange={(e) =>
                  setSortMode(e.target.value as any)
                }
                className="flex-1 bg-transparent text-[11px] text-slate-100 focus:outline-none"
              >
                <option value="new">Newest</option>
                <option value="price-high">Price: high → low</option>
                <option value="price-low">Price: low → high</option>
                <option value="stock-low">Stock: low first</option>
              </select>
            </div>
          </div>

          {/* live stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
                <p className="text-slate-400">Drops</p>
                <p className="mt-1 text-sm font-semibold text-slate-50">
                  {stats.drops}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
                <p className="text-slate-400">Creators</p>
                <p className="mt-1 text-sm font-semibold text-slate-50">
                  {stats.creators}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
                <p className="text-slate-400">Claims</p>
                <p className="mt-1 text-sm font-semibold text-slate-50">
                  {stats.claims}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
                <p className="text-slate-400">Coins issued</p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">
                  {stats.coinsIssued}
                </p>
              </div>
            </div>
          )}
        </section>

        {errorText && (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
            Error: {errorText}
          </div>
        )}

        {/* items */}
        <section className="flex-1">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-2xl bg-slate-900/80"
                />
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-700/60 bg-slate-950/70 p-6 text-center text-xs text-slate-400">
              No items match your search. Try a different keyword.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleItems.map((item) => {
                const imageSrc = item.cover_url?.trim()
                  ? item.cover_url
                  : `https://picsum.photos/seed/${item.id}/500`;
                const isOut =
                  !item.stock || item.stock <= 0;

                return (
                  <article
                    key={item.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-sm shadow-slate-950/60 backdrop-blur transition-transform hover:-translate-y-0.5 hover:border-violet-500/70"
                  >
                    <div className="relative h-28 w-full overflow-hidden">
                      <img
                        src={imageSrc}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                      <div className="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                        ₹{item.price}
                      </div>
                      <div
                        className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isOut
                            ? "bg-slate-800/90 text-slate-400"
                            : "bg-emerald-500/95 text-emerald-950"
                        }`}
                      >
                        {isOut
                          ? "Sold out"
                          : `Stock: ${item.stock ?? 0}`}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col px-3 py-2">
                      <h2 className="line-clamp-2 text-xs font-semibold text-slate-50">
                        {item.title}
                      </h2>
                      {item.creator_name && (
                        <p className="mt-1 text-[10px] text-sky-300">
                          by {item.creator_name}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleClaim(item)}
                      disabled={isOut}
                      className={`m-2 mb-2 rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                        isOut
                          ? "cursor-not-allowed bg-slate-800 text-slate-500"
                          : "bg-violet-500 text-slate-950 hover:bg-violet-400"
                      }`}
                    >
                      {isOut ? "Sold out" : "Claim ownership"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-4 mb-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>Built from a phone • {BRAND.name} alpha</span>
          <span className="hidden sm:inline">
            Supabase • Next.js • Tailwind design system v1
          </span>
        </footer>
      </main>

      <BottomNav active="home" />
    </div>
  );
}