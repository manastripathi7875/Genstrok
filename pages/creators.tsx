
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";
import Link from "next/link";
type ItemRow = {
  id: string;
  title: string;
  creator_name: string | null;
  cover_url: string | null;
  price: number;
  stock: number;
};

type CreatorCard = {
  name: string;
  itemCount: number;
  totalStock: number;
  sampleCover: string | null;
};

type NavKey = "home" | "wallet" | "creators" | "leaderboard";

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
      </div>
    </nav>
  );
}

export default function Creators() {
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("items")
        .select(
          "id, title, creator_name, cover_url, price, stock"
        );

      if (error) {
        console.log(error);
        setErrorText(error.message);
        setLoading(false);
        return;
      }

      const rows = (data || []) as ItemRow[];
      const map: Record<string, CreatorCard> = {};

      for (const item of rows) {
        const name = (item.creator_name || "").trim();
        if (!name) continue;

        if (!map[name]) {
          map[name] = {
            name,
            itemCount: 0,
            totalStock: 0,
            sampleCover: item.cover_url,
          };
        }

        map[name].itemCount += 1;
        map[name].totalStock += item.stock || 0;
        if (!map[name].sampleCover && item.cover_url) {
          map[name].sampleCover = item.cover_url;
        }
      }

      const list = Object.values(map).sort(
        (a, b) => b.itemCount - a.itemCount
      );
      setCreators(list);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-12">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-4 pt-6 sm:px-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              Creators on {BRAND.name}
            </h1>
            <p className="text-[11px] text-slate-400">
              Makers who&apos;ve listed drops on the market.
            </p>
          </div>
          <a
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200"
          >
            Back
          </a>
        </header>

        {errorText && (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
            Error: {errorText}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-slate-900/80"
              />
            ))}
          </div>
        ) : creators.length === 0 ? (
          <p className="text-xs text-slate-400">
            No creators yet. Add items with a creator name to see
            them here.
          </p>
        ) : (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {creators.map((c) => {
              const img = c.sampleCover
                ? c.sampleCover
                : `https://picsum.photos/seed/${encodeURIComponent(
                    c.name
                  )}/300`;

              return (
                <article
                  key={c.name}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 shadow-sm shadow-slate-950/60 backdrop-blur"
                >
                  <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-800/80">
                    <img
                      src={img}
                      alt={c.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-slate-50">
                      {c.name}
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {c.itemCount} drops • total stock{" "}
                      {c.totalStock}
                    </p>
                  </div>
                  <Link
                    href={`/creators/${encodeURIComponent(c.name)}`}
                    className="rounded-full bg-slate-900 px-3 py-1 text-[11px] text-slate-200 border border-slate-700/70 hover:border-violet-500"
                  >
                    View profile →
                  </Link>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <BottomNav active="creators" />
    </div>
  );
}