// pages/searchbar.tsx

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type ItemRow = {
  id: number;
  title: string;
  description?: string | null;
  price?: number | null;
  stock?: number | null;
  remaining?: number | null;
  cover_url?: string | null;
  creator_name?: string | null;
  coins_per_claim?: number | null;
  views?: number | null;
  likes?: number | null;
  claims?: number | null;
  is_published?: boolean | null;
};

type SearchType = "user" | "wallet" | "payment" | "task" | "project";

type BaseResult = {
  id: string;
  type: SearchType;
  title: string;
  subtitle?: string;
  extra?: string;
  thumbUrl?: string | null;
};

const PAGE_SIZE = 20;

export default function GlobalSearchPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [allDropItems, setAllDropItems] = useState<ItemRow[]>([]);
  const [itemsPage, setItemsPage] = useState(0);

  const [otherResults, setOtherResults] = useState<BaseResult[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  const [activeSegment, setActiveSegment] = useState<
    "all" | "drops" | "users" | "money" | "content"
  >("all");
  const [sortBy, setSortBy] = useState<"relevance" | "newest" | "popular">(
    "relevance"
  );

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // load recent search from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("genstrok_recent_searches");
    if (!raw) return;
    try {
      setRecent(JSON.parse(raw));
    } catch {
      setRecent([]);
    }
  }, []);

  const saveRecent = (term: string) => {
    if (!term.trim() || typeof window === "undefined") return;
    const clean = term.trim();
    const next = [clean, ...recent.filter((r) => r !== clean)].slice(0, 10);
    setRecent(next);
    window.localStorage.setItem(
      "genstrok_recent_searches",
      JSON.stringify(next)
    );
  };

  // helpers
  function formatCount(n: number | null | undefined): string {
    const num = n || 0;
    if (num >= 1_000_000)
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1_000)
      return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(num);
  }

  // main search
  async function runSearch(term: string) {
    const q = term.trim();
    if (!q) {
      setAllDropItems([]);
      setOtherResults([]);
      setItemsPage(0);
      return;
    }

    setLoading(true);
    setItemsPage(0);

    try {
      // 1) fetch batch from items table, same table as homepage
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200); // enough for now

      if (error) {
        console.error("Items fetch error", error.message);
        setAllDropItems([]);
      } else {
        const raw = (data || []) as any[];

        // same publish filter as homepage
        const publishedOnly = raw.filter(
          (row) =>
            row.is_published === true ||
            typeof row.is_published === "undefined"
        ) as ItemRow[];

        const lowerQ = q.toLowerCase();

        // frontend filter on multiple fields
        const matched = publishedOnly.filter((it) => {
          const fields = [
            it.id?.toString() || "",
            it.title || "",
            it.description || "",
            it.creator_name || "",
          ];
          return fields
            .map((f) => f.toLowerCase())
            .some((f) => f.includes(lowerQ));
        });

        setAllDropItems(matched);
      }

      // 2) other entities (lightweight, optional)
      const collected: BaseResult[] = [];

      // users
      const { data: users, error: usersErr } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .or(
          `username.ilike.%${q}%,full_name.ilike.%${q}%`
        );

      if (!usersErr && users) {
        for (const u of users) {
          collected.push({
            id: String(u.id),
            type: "user",
            title: u.full_name || u.username || "User",
            subtitle: u.username ? `@${u.username}` : undefined,
            thumbUrl: u.avatar_url || null,
          });
        }
      }

      // wallets
      const { data: wallets, error: walletsErr } = await supabase
        .from("wallets")
        .select("user_id,balance")
        .ilike("user_id", `%${q}%`);

      if (!walletsErr && wallets) {
        for (const w of wallets) {
          collected.push({
            id: String(w.user_id),
            type: "wallet",
            title: `Wallet ${w.user_id}`,
            extra: `Balance: ${w.balance} ${BRAND.coinName}`,
          });
        }
      }

      // payments
      const { data: payments, error: payErr } = await supabase
        .from("payments")
        .select("id,amount,status,receiver_name")
        .or(
          `id.ilike.%${q}%,receiver_name.ilike.%${q}%`
        );

      if (!payErr && payments) {
        for (const p of payments) {
          collected.push({
            id: String(p.id),
            type: "payment",
            title: `Payment ${p.id}`,
            subtitle: p.receiver_name || undefined,
            extra: `${p.amount} · ${p.status}`,
          });
        }
      }

      setOtherResults(collected);
    } catch (e) {
      console.error("Global search failed", e);
      setAllDropItems([]);
      setOtherResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveRecent(query);
    await runSearch(query);
  }

  async function handleRecentClick(term: string) {
    setQuery(term);
    saveRecent(term);
    await runSearch(term);
  }

  function handleItemClick(item: ItemRow) {
    router.push(`/drop/${item.id}`);
  }

  function handleOtherClick(r: BaseResult) {
    if (r.type === "user") {
      router.push(`/creator/${r.id}`);
    } else if (r.type === "wallet") {
      router.push("/wallet");
    } else if (r.type === "payment") {
      router.push(`/payments/${r.id}`);
    } else if (r.type === "task") {
      router.push(`/tasks/${r.id}`);
    } else if (r.type === "project") {
      router.push(`/projects/${r.id}`);
    }
  }

  // infinite scroll style, but frontend
  const visibleDropItems = useMemo(() => {
    const limit = (itemsPage + 1) * PAGE_SIZE;
    return allDropItems.slice(0, limit);
  }, [allDropItems, itemsPage]);

  const hasMoreItems = visibleDropItems.length < allDropItems.length;

  async function handleLoadMore() {
    if (!hasMoreItems) return;
    setLoadingMore(true);
    setTimeout(() => {
      setItemsPage((p) => p + 1);
      setLoadingMore(false);
    }, 200);
  }

  const filteredOthers = useMemo(() => {
    let data = [...otherResults];

    if (activeSegment === "users") {
      data = data.filter((r) => r.type === "user");
    } else if (activeSegment === "money") {
      data = data.filter(
        (r) => r.type === "wallet" || r.type === "payment"
      );
    } else if (activeSegment === "content") {
      data = data.filter(
        (r) => r.type === "task" || r.type === "project"
      );
    }

    if (sortBy === "newest") {
      data = data.sort((a, b) => (a.id < b.id ? 1 : -1));
    }

    return data;
  }, [otherResults, activeSegment, sortBy]);

  // if segment is not drops / all then hide drop list
  const showDrops =
    activeSegment === "all" || activeSegment === "drops";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#04040b] via-[#050516] to-black text-white">
      {/* top header */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center text-xs"
          >
            ←
          </button>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-purple-300/80">
              {BRAND.name || "Genstrok"}
            </div>
            <div className="text-sm font-semibold">Universal search</div>
          </div>
          <button
            onClick={() => router.push("/settings")}
            className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center text-[11px]"
          >
            ⚙
          </button>
        </div>

        {/* type icons row */}
        <div className="px-2 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide text-[11px]">
            {[
              { key: "id", label: "ID", icon: "🔑" },
              { key: "post", label: "Post", icon: "🧿" },
              { key: "video", label: "Video", icon: "🎥" },
              { key: "shopping", label: "Shopping", icon: "🛒" },
              { key: "blog", label: "Blog", icon: "✍️" },
              { key: "task", label: "Task", icon: "✅" },
              { key: "project", label: "Project", icon: "📁" },
              { key: "wallet", label: "Wallet", icon: "👛" },
              { key: "payments", label: "Payments", icon: "💳" },
            ].map((item) => (
              <div
                key={item.key}
                className="flex flex-col items-center justify-center px-2 py-1 rounded-2xl bg-white/3 border border-white/5 min-w-[60px]"
              >
                <div className="text-lg">{item.icon}</div>
                <div className="text-[10px] mt-0.5 text-white/80">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* main search box */}
        <form onSubmit={handleSubmit} className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-white/5 rounded-3xl px-3 py-2">
            <div className="flex flex-col gap-1 mr-1">
              <button
                type="button"
                className="h-7 w-7 rounded-xl bg-black/60 flex items-center justify-center text-xs"
              >
                📷
              </button>
              <button
                type="button"
                className="h-7 w-7 rounded-xl bg-black/60 flex items-center justify-center text-xs"
              >
                🧬
              </button>
            </div>

            <input
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/40"
              placeholder="Search drops by title, description or creator"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 font-semibold"
            >
              Search
            </button>
          </div>
        </form>

        {/* tabs and sort */}
        <div className="px-4 pb-3 text-[11px] flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {[
              { id: "all", label: "All" },
              { id: "drops", label: "Drops" },
              { id: "users", label: "Creators" },
              { id: "money", label: "Money" },
              { id: "content", label: "Content" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSegment(tab.id as any)}
                className={`px-2.5 py-1 rounded-2xl border ${
                  activeSegment === tab.id
                    ? "border-purple-400 bg-purple-500/20"
                    : "border-white/10 bg-white/3"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            className="bg-white/5 border border-white/10 rounded-2xl px-2 py-1 text-[11px] outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="popular">Popular</option>
          </select>
        </div>
      </div>

      {/* recent search chips */}
      {recent.length > 0 && (
        <div className="px-4 pt-3">
          <div className="text-[11px] text-white/50 mb-1.5">
            Recent searches
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleRecentClick(item)}
                className="px-3 py-1.5 rounded-2xl bg-white/4 border border-white/10 text-[11px]"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* results */}
      <div className="px-4 pt-4 pb-28">
        {loading && (
          <div className="text-xs text-white/60 mb-3">
            Searching across drops, users and wallet data...
          </div>
        )}

        {!loading &&
          query &&
          showDrops &&
          visibleDropItems.length === 0 &&
          filteredOthers.length === 0 && (
            <div className="text-xs text-white/40 mt-6">
              Nothing found for{" "}
              <span className="text-white">"{query}"</span>.  
              This searches drop id, title, description and creator name from your
              items table.
            </div>
          )}

        {/* drops vertical list */}
        {showDrops && visibleDropItems.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] text-white/60 mb-2">
              Drops
            </div>
            <div className="flex flex-col gap-3">
              {visibleDropItems.map((it) => {
                const left =
                  it.remaining != null ? it.remaining : it.stock ?? 0;
                const stock = it.stock ?? left;
                const isSoldOut = !left || left <= 0;

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handleItemClick(it)}
                    className="w-full rounded-2xl bg-white/4 border border-white/10 overflow-hidden text-left"
                  >
                    <div className="h-40 w-full bg-black/60">
                      {it.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.cover_url}
                          alt={it.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-3xl">
                          🧿
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-[11px] text-white/50 mb-0.5">
                            {it.creator_name || "Creator"}
                          </div>
                          <div className="text-sm font-semibold line-clamp-2">
                            {it.title}
                          </div>
                        </div>
                        {isSoldOut && (
                          <span className="shrink-0 rounded-full bg-red-500/20 border border-red-500/60 px-2 py-0.5 text-[9px] text-red-200">
                            Sold out
                          </span>
                        )}
                      </div>

                      {it.description && (
                        <div className="text-[11px] text-white/60 line-clamp-2">
                          {it.description}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-white/60 pt-1">
                        <span>👁 {formatCount(it.views)}</span>
                        <span>★ {formatCount(it.likes)}</span>
                        <span>💎 {formatCount(it.claims)}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-white/70 pt-1">
                        <span>
                          💰{" "}
                          {it.price && it.price > 0
                            ? `₹${it.price}`
                            : "Free"}
                        </span>
                        <span>
                          💠 +{it.coins_per_claim || 10}{" "}
                          {BRAND.coinName}
                        </span>
                        <span>
                          📦 {left} / {stock} left
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMoreItems && (
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  className="px-4 py-1.5 text-xs rounded-2xl bg-white/10 border border-white/20"
                >
                  {loadingMore
                    ? "Loading..."
                    : "Load more drops"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* other entities */}
        {filteredOthers.length > 0 && (
          <div>
            <div className="text-[11px] text-white/60 mb-2">
              Other results
            </div>
            <div className="flex flex-col gap-3">
              {filteredOthers.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  type="button"
                  onClick={() => handleOtherClick(r)}
                  className="w-full rounded-2xl bg-white/4 border border-white/10 flex gap-3 p-3 text-left"
                >
                  <div className="h-12 w-12 rounded-xl bg-black/60 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                    {r.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.thumbUrl}
                        alt={r.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {r.type === "user" && "👤"}
                        {r.type === "wallet" && "👛"}
                        {r.type === "payment" && "💳"}
                        {r.type === "task" && "✅"}
                        {r.type === "project" && "📁"}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-white/50 mb-0.5">
                      <span className="uppercase tracking-[0.18em]">
                        {r.type.toUpperCase()}
                      </span>
                      {r.subtitle && (
                        <span className="truncate">
                          · {r.subtitle}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium truncate">
                      {r.title}
                    </div>
                    {r.extra && (
                      <div className="text-[11px] text-white/50 mt-0.5 truncate">
                        {r.extra}
                      </div>
                    )}
                  </div>

                  <div className="self-center text-xs text-white/30">
                    ›
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}