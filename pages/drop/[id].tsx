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
  creator_id?: string | null;
  is_paid?: boolean | null;
  payment_link?: string | null;
  coins_per_claim?: number | null;
};

function formatCount(n: number | null | undefined): string {
  const num = n || 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(num);
}

export default function DropPage() {
  const router = useRouter();
  const { id } = router.query;

  const [item, setItem] = useState<DropItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState<boolean>(true);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [ownCount, setOwnCount] = useState<number | null>(null);
  const [ownCoins, setOwnCoins] = useState<number | null>(null);
  const [ownLoading, setOwnLoading] = useState(false);
  const [totalClaims, setTotalClaims] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // user
  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setCurrentUser(null);
        setNeedsLogin(false);
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

  // item
  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("items")
        .select(
          "id, title, price, stock, cover_url, creator_name, creator_id, is_paid, payment_link, coins_per_claim"
        )
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

  // your ownership + total claims
  useEffect(() => {
    if (!item) {
      setTotalClaims(null);
      setOwnCount(null);
      setOwnCoins(null);
      return;
    }

    async function loadTotals() {
      setOwnLoading(true);
      const { data, error } = await supabase
        .from("ownerships")
        .select("id, buyer_id, coins")
        .eq("item_id", item.id);

      if (error) {
        console.error("Ownership summary error", error);
        setTotalClaims(null);
        setOwnCount(null);
        setOwnCoins(null);
        setOwnLoading(false);
        return;
      }

      const rows = (data || []) as { id: string; buyer_id: string; coins: number | null }[];
      setTotalClaims(rows.length);

      if (!currentUser) {
        setOwnCount(null);
        setOwnCoins(null);
      } else {
        const mine = rows.filter((r) => r.buyer_id === currentUser.id);
        setOwnCount(mine.length);
        setOwnCoins(mine.reduce((sum, r) => sum + (r.coins || 0), 0));
      }
      setOwnLoading(false);
    }

    loadTotals();
  }, [item, currentUser]);

  async function handleShare() {
    if (typeof window === "undefined" || !item) return;
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: "Claim this drop on Genstrok",
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setToast("Link copied to clipboard.");
      }
    } catch (err) {
      console.error("Share error", err);
    }
  }

  async function handleClaim() {
    if (!item) return;

    if (!currentUser) {
      setNeedsLogin(true);
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
        setToast("Not enough wallet balance. Add money to wallet first.");
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

    setClaiming(true);
    setToast(null);

    try {
      const coins =
        item.coins_per_claim && item.coins_per_claim > 0
          ? item.coins_per_claim
          : 10;

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

      const newStock = (item.stock || 0) - 1;
      const { error: stockErr } = await supabase
        .from("items")
        .update({ stock: newStock })
        .eq("id", item.id);

      if (stockErr) {
        console.error(stockErr);
      }

      setItem((prev) => (prev ? { ...prev, stock: newStock } : prev));

      setTotalClaims((prev) => (prev ?? 0) + 1);
      setOwnCount((prev) => (prev ?? 0) + 1);
      setOwnCoins((prev) => (prev ?? 0) + coins);

      setToast(
        `Claimed "${item.title}" +${coins} ${BRAND.coinName}!`
      );
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050816] text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">Loading drop…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#050816] text-slate-50 flex flex-col items-center justify-center p-6">
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

  // slug for creator profile: prefer name, else id
  const creatorSlug =
    item.creator_name
      ? encodeURIComponent(item.creator_name)
      : item.creator_id
      ? encodeURIComponent(item.creator_id)
      : null;

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 pb-10">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      {/* header */}
      <header className="relative z-20 sticky top-0 flex items-center gap-3 px-4 py-3 bg-[#050816]/95 backdrop-blur border-b border-slate-900">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-lg"
        >
          ←
        </button>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Drop detail
          </span>
          <span className="text-sm font-semibold">Genstrok</span>
        </div>
        <div className="ml-auto text-right text-[11px]">
          <div className="text-[10px] text-slate-400">Wallet</div>
          <div className="text-xs font-semibold text-emerald-300">
            {walletLoading ? "…" : `₹${walletBalance.toFixed(2)}`}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-md px-4 pt-4 pb-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 shadow-xl shadow-black/60 overflow-hidden">
          {/* image */}
          {item.cover_url && (
            <div className="h-64 w-full overflow-hidden bg-slate-900">
              <img
                src={item.cover_url}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* title + creator */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-slate-50">
                  {item.title}
                </h1>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                  <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
                    {item.creator_name
                      ? item.creator_name.charAt(0).toUpperCase()
                      : "C"}
                  </div>
                  <span className="truncate max-w-[140px]">
                    {item.creator_name || "Genstrok creator"}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-500" />
                  <span>Drop</span>
                </div>
              </div>
            </div>

            {/* stats */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <DetailStat label="VIEWS" value="3.2M" icon="👁" />
              <DetailStat label="LIKES" value="22K" icon="★" />
              <DetailStat
                label="CLAIMS"
                value={formatCount(totalClaims)}
                icon="💎"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <DetailStat
                label="STOCK LEFT"
                value={String(item.stock)}
                icon="📦"
              />
              <DetailStat
                label={`${BRAND.coinName.toUpperCase()} / CLAIM`}
                value={`+${item.coins_per_claim || 10}`}
                icon="💠"
              />
              <DetailStat
                label="PRICE"
                value={item.is_paid ? `₹${item.price}` : "Free"}
                icon="💰"
              />
            </div>

            {/* big claim */}
            <button
              type="button"
              onClick={handleClaim}
              disabled={claiming}
              className="w-full h-11 rounded-full bg-violet-500 text-[12px] font-semibold text-slate-50 hover:bg-violet-400 disabled:opacity-60 shadow-lg shadow-violet-500/40"
            >
              {claiming
                ? item.is_paid
                  ? "Processing…"
                  : "Claiming…"
                : item.is_paid
                ? "Buy and claim now"
                : "Claim this drop now"}
            </button>

            {/* your ownership */}
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Your ownership</h2>
              {!currentUser ? (
                <p className="text-[11px] text-slate-400">
                  Login to see how many claims you already own.
                </p>
              ) : ownLoading ? (
                <p className="text-[11px] text-slate-400">Checking…</p>
              ) : ownCount && ownCount > 0 ? (
                <p className="text-[11px] text-slate-300">
                  You own <span className="font-semibold">{ownCount}</span>{" "}
                  claim{ownCount > 1 ? "s" : ""} of this drop and earned{" "}
                  <span className="font-semibold">
                    {ownCoins ?? 0} {BRAND.coinName}
                  </span>{" "}
                  from it.
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  You have not claimed this drop yet. Be early and lock your
                  ownership.
                </p>
              )}
            </div>

            {/* description */}
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Drop details</h2>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Detailed description for this drop will appear here. Creators
                can write story, utility, rewards or any special instructions
                for supporters.
              </p>
            </div>

            {/* creator card */}
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Creator</h2>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-[11px]">
                <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-[11px]">
                  {item.creator_name
                    ? item.creator_name.charAt(0).toUpperCase()
                    : "C"}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">
                    {item.creator_name || "Genstrok creator"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Publishing drops on Genstrok ownership sandbox.
                  </p>
                </div>
                {creatorSlug && (
                  <a
                    href={`/creators/${creatorSlug}`}
                    className="text-[11px] text-violet-300 underline underline-offset-2"
                  >
                    View all drops
                  </a>
                )}
              </div>
            </div>

            {/* bottom actions */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <a
                  href={
                    creatorSlug ? `/creators/${creatorSlug}` : "/creators"
                  }
                  className="flex-1 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 text-center border border-slate-700 hover:bg-slate-800"
                >
                  View all drops
                </a>
                <button
                  type="button"
                  onClick={handleShare}
                  className="px-3 py-2 rounded-2xl border border-slate-700 bg-slate-900 text-[11px] text-slate-200"
                >
                  Share
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Claim this drop on Genstrok to earn {BRAND.coinName} and secure
                your early ownership record.
              </p>
            </div>
          </div>
        </section>

        <p className="mt-4 text-[10px] text-slate-500 text-center">
          Built on {BRAND.name}. Every claim is a tiny piece of digital
          ownership.
        </p>
      </main>

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
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="max-w-sm rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 shadow-lg shadow-emerald-900/40">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailStat({
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