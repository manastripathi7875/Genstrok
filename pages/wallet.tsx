import { useEffect, useMemo, useState } from "react";
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
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [rows, setRows] = useState<OwnershipRow[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, ItemRow>>({});
  const [loading, setLoading] = useState(true);

  const [coinPulse, setCoinPulse] = useState(false);

  // 🧠 1) user + ownerships + item titles load
  useEffect(() => {
    async function load() {
      setLoading(true);

      // current user lao
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        console.error(authError);
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      const currentUser = authData?.user;
      if (!currentUser) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // ownerships jaha buyer_id = user.id
      const { data: ownData, error: ownError } = await supabase
        .from("ownerships")
        .select("id, created_at, item_id, buyer_name, buyer_id, coins")
        .eq("buyer_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (ownError) {
        console.error(ownError);
        setRows([]);
        setItemsById({});
        setLoading(false);
        return;
      }

      const owns = (ownData || []) as OwnershipRow[];
      setRows(owns);

      // items titles fetch karo
      const ids = Array.from(
        new Set(owns.map((o) => o.item_id).filter(Boolean))
      );

      if (ids.length === 0) {
        setItemsById({});
        setLoading(false);
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id, title")
        .in("id", ids);

      if (itemError) {
        console.error(itemError);
        setItemsById({});
        setLoading(false);
        return;
      }

      const map: Record<string, ItemRow> = {};
      (itemData || []).forEach((it: any) => {
        map[it.id] = { id: it.id, title: it.title };
      });

      setItemsById(map);
      setLoading(false);
    }

    load();
  }, []);

  // 🧠 2) Realtime: new claims aate hi wallet auto-update
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

          // sirf isi user ke rows
          if (newRow.buyer_id !== user.id) return;

          setRows((prev) => [newRow, ...prev]);

          // agar item title abhi map me nahi to later fetch kar sakte hain
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

          // coin animation trigger
          setCoinPulse(true);
          setTimeout(() => setCoinPulse(false), 900);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, itemsById]);

  // 🧮 3) Total coins calculate
  const totalCoins = useMemo(
    () =>
      rows.reduce(
        (sum, r) => sum + (r.coins ? r.coins : 0),
        0
      ),
    [rows]
  );

  // 🧮 4) Simple grouped summary (optional future use)
  // Abhi sirf total coins hi show karenge clean UI ke liye

  // 🔐 5) Login required screen
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please log in to view your {BRAND.coinName} wallet.
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

  // 🖼 6) MAIN WALLET UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
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
              {BRAND.coinName}
            </h1>
          </div>
        </header>

        {/* balance card */}
        <section className="mb-6">
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
                  Total balance
                </p>
                <p className="text-2xl font-bold tracking-tight text-emerald-50">
                  {totalCoins}
                </p>
                <p className="text-[11px] text-emerald-100/80">
                  {BRAND.coinName}
                </p>
              </div>
            </div>
            <div className="text-right text-[11px] text-emerald-100/80">
              <p>Auto-updating</p>
              <p className="mt-1 text-[10px] text-emerald-50/80">
                New claims instantly appear here.
              </p>
            </div>
          </div>
        </section>

        {/* history list */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-100">
            Claim history
          </h2>

          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-slate-400">
              You haven&apos;t claimed anything yet. Go to the home
              page and claim your first drop to earn coins.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const item = itemsById[row.item_id];
                const title =
                  item?.title || "Claimed item";
                const coins = row.coins || 0;
                const date = new Date(
                  row.created_at
                ).toLocaleString();

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
    </div>
  );
}