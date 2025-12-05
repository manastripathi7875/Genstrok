import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Item = {
  id: string;
  title: string;
  price: number;
  cover_url: string;
};

type OwnershipRow = {
  id: string;
  item_id: string;
  coins: number;
  created_at: string | null;
};

type JoinedRow = {
  id: string;
  coins: number;
  created_at: string | null;
  item?: Item;
};

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<JoinedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [totalCoins, setTotalCoins] = useState(0);
  const [totalClaims, setTotalClaims] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // 1) User check
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(data.user);
      const identity = data.user.email || "";

      // 2) Ownership rows for this user
      const { data: ownerships, error } = await supabase
        .from("ownerships")
        .select("id, item_id, coins, created_at")
        .eq("buyer_name", identity);

      if (error) {
        console.log(error);
        setErrorText(error.message);
        setLoading(false);
        return;
      }

      const ownList = (ownerships || []) as OwnershipRow[];
      setTotalClaims(ownList.length);
      setTotalCoins(
        ownList.reduce((sum, row) => sum + (row.coins || 0), 0)
      );

      if (ownList.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 3) Unique item_ids se items fetch karo
      const ids = Array.from(
        new Set(
          ownList
            .map((o) => o.item_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      let itemsMap: Record<string, Item> = {};
      if (ids.length > 0) {
        const { data: items, error: itemsErr } = await supabase
          .from("items")
          .select("id, title, price, cover_url")
          .in("id", ids);

        if (!itemsErr && items) {
          for (const it of items as Item[]) {
            itemsMap[it.id] = it;
          }
        }
      }

      const joined: JoinedRow[] = ownList
        .slice()
        .sort((a, b) => {
          const da = a.created_at ? Date.parse(a.created_at) : 0;
          const db = b.created_at ? Date.parse(b.created_at) : 0;
          return db - da;
        })
        .map((row) => ({
          ...row,
          item: itemsMap[row.item_id],
        }));

      setRows(joined);
      setLoading(false);
    }

    load();
  }, []);

  function formatDate(value: string | null) {
    if (!value) return "Unknown time";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Unknown time";
    return d.toLocaleString();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-12 pt-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/80 ring-1 ring-slate-700/60">
              <span className="text-lg font-bold tracking-tight">P</span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Claim history
              </div>
              <div className="text-[11px] text-slate-400">
                All your past claims & coins
              </div>
            </div>
          </div>

          <a
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm backdrop-blur hover:border-slate-500 hover:bg-slate-900"
          >
            Back to store
          </a>
        </header>

        {/* If not logged in */}
        {!user && !loading && (
          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/70 backdrop-blur">
            <h2 className="text-base font-semibold text-slate-50">
              Sign in to see your history
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              You need to log in with the same email you use when claiming
              items. Then we can show your coins and claims.
            </p>
            <a
              href="/auth"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-violet-400"
            >
              Go to login / signup
            </a>
          </section>
        )}

        {/* Error */}
        {errorText && (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
            Error: {errorText}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-slate-900/80"
              />
            ))}
          </div>
        )}

        {/* When logged-in & loaded */}
        {user && !loading && (
          <>
            {/* Summary */}
            <section className="mb-5 mt-1 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 shadow-md shadow-slate-950/60 backdrop-blur">
              <p className="text-[11px] text-slate-400 mb-1">
                Signed in as{" "}
                <span className="font-semibold text-slate-200">
                  {user.email}
                </span>
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[11px] text-slate-400">Total claims</p>
                  <p className="text-xl font-semibold text-slate-50">
                    {totalClaims}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-slate-400">Total coins</p>
                  <p className="text-xl font-semibold text-violet-300">
                    {totalCoins}
                  </p>
                </div>
              </div>
            </section>

            {/* No claims */}
            {rows.length === 0 ? (
              <p className="mt-6 text-center text-sm text-slate-400">
                You haven&apos;t claimed anything yet. Go to the store and
                claim your first item to see it here.
              </p>
            ) : (
              <section className="space-y-3">
                {rows.map((row) => {
                  const item = row.item;
                  const imageSrc = item?.cover_url
                    ? item.cover_url
                    : `https://picsum.photos/seed/${row.id}/300`;

                  return (
                    <article
                      key={row.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-3 shadow-sm shadow-slate-950/50 backdrop-blur"
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-800/80">
                        <img
                          src={imageSrc}
                          alt={item?.title || "Claimed item"}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-50">
                          {item?.title || "Unknown item"}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {item ? `₹${item.price} • ` : ""}
                          {formatDate(row.created_at)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">
                          Coins earned
                        </div>
                        <div className="text-sm font-semibold text-emerald-300">
                          +{row.coins || 0}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}