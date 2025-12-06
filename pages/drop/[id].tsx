// pages/drop/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { BRAND } from "../../lib/brand";

type DropItem = {
  id: string;
  title: string;
  price: number;
  stock: number;
  cover_url: string | null;
  creator_name: string | null;
};

export default function DropPage() {
  const router = useRouter();
  const { id } = router.query;

  const [item, setItem] = useState<DropItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("items")
        .select("id, title, price, stock, cover_url, creator_name")
        .eq("id", id as string)
        .maybeSingle();

      if (error) {
        console.error(error);
        setItem(null);
      } else {
        setItem(data as any);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">Loading drop…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <p className="text-lg font-semibold mb-2">Drop not found</p>
        <p className="text-sm text-slate-400 mb-4">
          This link may be invalid or the drop was removed.
        </p>
        <a
          href="/"
          className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400"
        >
          Back to Genstrok →
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
      {/* soft background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-md px-4 pt-5 pb-8">
        {/* top bar */}
        <header className="mb-4 flex items-center justify-between">
          <a
            href="/"
            className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-200"
          >
            ← Genstrok market
          </a>
          <span className="text-[11px] text-slate-400">
            Shareable drop
          </span>
        </header>

        {/* card */}
        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 shadow-xl shadow-black/60 overflow-hidden">
          {item.cover_url && (
            <div className="h-64 w-full overflow-hidden bg-slate-900">
              <img
                src={item.cover_url}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-50">
                  {item.title}
                </h1>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  by{" "}
                  {item.creator_name || "Genstrok creator"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Price</p>
                <p className="text-base font-semibold text-emerald-300">
                  ₹{item.price.toFixed(0)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Stock:{" "}
                  <span className="text-slate-100">
                    {item.stock}
                  </span>
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-300">
              Claim this drop on Genstrok to earn{" "}
              {BRAND.coinName} and secure your early ownership
              record.
            </p>

            <div className="flex gap-2 pt-1">
              <a
                href={`/?drop=${encodeURIComponent(item.id)}`}
                className="flex-1 rounded-2xl bg-violet-500 px-4 py-2 text-xs font-semibold text-slate-950 text-center hover:bg-violet-400"
              >
                Open in Genstrok app →
              </a>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.share?.({
                      title: item.title,
                      text: `Claim this drop on Genstrok`,
                      url: window.location.href,
                    });
                  }
                }}
                className="px-3 py-2 rounded-2xl border border-slate-700 bg-slate-900 text-[11px] text-slate-200"
              >
                Share
              </button>
            </div>
          </div>
        </section>

        <p className="mt-4 text-[10px] text-slate-500 text-center">
          Built on {BRAND.name}. Every claim is a tiny piece of
          digital ownership.
        </p>
      </main>
    </div>
  );
}