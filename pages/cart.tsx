// pages/cart.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type CartRow = {
  id: number;
  item_id: number;
  price: number;
  is_checked_out: boolean | null;
  items: {
    id: number;
    title: string;
    cover_url: string | null;
    price: number;
    is_paid: boolean | null;
    coins_per_claim: number | null;
    stock: number | null;
  } | null;
};

export default function CartPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState<boolean>(true);

  const [rows, setRows] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

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
        setNeedsLogin(true);
        setLoading(false);
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

  // cart items
  useEffect(() => {
    async function loadCart() {
      if (!currentUser) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("cart")
        .select(
          "id, item_id, price, is_checked_out, items(id, title, cover_url, price, is_paid, coins_per_claim, stock)"
        )
        .eq("user_id", currentUser.id)
        .eq("is_checked_out", false)
        .order("id", { ascending: false });

      if (error) {
        console.error("Cart load error", error);
        setRows([]);
      } else {
        setRows((data || []) as any);
      }

      setLoading(false);
    }

    loadCart();
  }, [currentUser]);

  const totalAmount = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const base = r.price || r.items?.price || 0;
        return sum + base;
      }, 0),
    [rows]
  );

  async function handleRemoveRow(id: number) {
    const { error } = await supabase.from("cart").delete().eq("id", id);
    if (error) {
      console.error("Remove from cart error", error);
      setToast("Could not remove from cart.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleCheckout() {
    if (!currentUser) {
      setNeedsLogin(true);
      return;
    }

    if (rows.length === 0) {
      setToast("Cart is empty.");
      return;
    }

    if (walletLoading) {
      setToast("Wallet still loading.");
      return;
    }

    if (walletBalance < totalAmount) {
      setToast("Not enough wallet balance for all drops.");
      return;
    }

    setCheckingOut(true);

    const newBalance = walletBalance - totalAmount;

    const { error: walletErr } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("user_id", currentUser.id);

    if (walletErr) {
      console.error("Wallet update error", walletErr);
      setToast("Wallet update failed.");
      setCheckingOut(false);
      return;
    }

    setWalletBalance(newBalance);

    const buyerName =
      currentUser.user_metadata?.full_name ||
      currentUser.email ||
      currentUser.id;

    // process each drop in cart
    for (const row of rows) {
      const it = row.items;
      if (!it) continue;
      if (!it.stock || it.stock <= 0) continue;

      const coins = it.coins_per_claim || 10;

      const { error: ownErr } = await supabase.from("ownerships").insert({
        item_id: it.id,
        buyer_id: currentUser.id,
        buyer_name: buyerName,
        coins,
      });

      if (ownErr) {
        console.error("Ownership insert error", ownErr);
        continue;
      }

      const { error: stockErr } = await supabase
        .from("items")
        .update({ stock: (it.stock || 0) - 1 })
        .eq("id", it.id);

      if (stockErr) {
        console.error("Stock update error", stockErr);
      }
    }

    // mark cart rows as checked out
    const { error: clearErr } = await supabase
      .from("cart")
      .update({ is_checked_out: true })
      .eq("user_id", currentUser.id)
      .eq("is_checked_out", false);

    if (clearErr) {
      console.error("Cart clear error", clearErr);
    }

    setRows([]);
    setCheckingOut(false);
    setToast("Successfully bought all drops in cart.");
  }

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 pb-10">
      {/* header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-[#050816]/95 backdrop-blur border-b border-slate-900">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-lg"
        >
          ←
        </button>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Cart
          </span>
          <span className="text-sm font-semibold">Genstrok checkout</span>
        </div>
        <div className="ml-auto text-right text-[11px]">
          <div className="text-[10px] text-slate-400">Wallet balance</div>
          <div className="text-xs font-semibold text-emerald-300">
            {walletLoading ? "…" : `₹${walletBalance.toFixed(2)}`}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-md px-4 pt-4 pb-8">
        {needsLogin && !currentUser ? (
          <p className="text-sm text-slate-300">
            Login to use the cart feature.
          </p>
        ) : loading ? (
          <p className="text-sm text-slate-300">Loading cart...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-300">
            Your cart is empty. Add paid drops from the detail page.
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const it = row.items;
              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3 flex gap-3"
                >
                  <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
                    {it?.cover_url ? (
                      <img
                        src={it.cover_url}
                        alt={it.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-semibold line-clamp-2">
                        {it?.title || "Drop"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Price ₹{row.price || it?.price || 0}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <button
                        onClick={() =>
                          router.push(`/drop/${row.item_id.toString()}`)
                        }
                        className="text-[11px] text-violet-300"
                      >
                        View drop
                      </button>
                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-[11px] text-slate-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* total and pay */}
            <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950/90 p-3 space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Total amount</span>
                <span className="font-semibold text-emerald-300">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkingOut || rows.length === 0}
                className="mt-2 w-full h-10 rounded-full bg-violet-500 text-[12px] font-semibold text-slate-50 hover:bg-violet-400 disabled:opacity-60"
              >
                {checkingOut ? "Processing..." : "Buy all drops"}
              </button>
              <p className="text-[10px] text-slate-500 mt-1">
                After payment, each drop will be claimed and files will unlock
                for your account.
              </p>
            </div>
          </div>
        )}
      </main>

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