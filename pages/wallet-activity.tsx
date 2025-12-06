// pages/wallet-activity.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type WalletRow = {
  user_id: string;
  balance: number;
};

export default function WalletActivityPage() {
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [reqAmount, setReqAmount] = useState<string>("0");
  const [reqUpi, setReqUpi] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  // 🔔 helper – simple toast
  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  // 1) user + wallet load
  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);

      // wallet row lao (ya banao)
      const { data: row, error } = await supabase
        .from("wallets")
        .select("user_id, balance")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error(error);
        setWallet({ user_id: currentUser.id, balance: 0 });
        setLoading(false);
        return;
      }

      if (!row) {
        // agar wallet nahi hai to create karo
        const { data: created, error: createError } = await supabase
          .from("wallets")
          .insert({
            user_id: currentUser.id,
            balance: 0,
          })
          .select("user_id, balance")
          .maybeSingle();

        if (createError) {
          console.error(createError);
          setWallet({ user_id: currentUser.id, balance: 0 });
        } else if (created) {
          setWallet({
            user_id: created.user_id,
            balance: Number(created.balance || 0),
          });
        }
      } else {
        setWallet({
          user_id: row.user_id,
          balance: Number(row.balance || 0),
        });
      }

      setLoading(false);
    }

    load();
  }, []);

  // 2) Realtime: wallet me UPDATE ho to balance auto refresh
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("wallet-activity-balance")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as { user_id: string; balance: number };
          setWallet({
            user_id: newRow.user_id,
            balance: Number(newRow.balance || 0),
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // 3) fake withdrawal request (abhi sirf demo, real Cashfree baad me)
  async function handleRequestWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !wallet) {
      showToast("Please log in first.");
      return;
    }

    const amount = Number(reqAmount || "0");
    if (!reqUpi || amount <= 0) {
      showToast("Enter valid UPI and amount.");
      return;
    }

    if (amount > wallet.balance) {
      showToast("Amount is more than your available balance.");
      return;
    }

    setRequesting(true);
    try {
      // yaha future me: payout_requests table me insert + Cashfree API call
      // abhi sirf front-end demo:
      showToast(
        `Withdrawal request created (₹${amount}) – demo mode only, no real money.`
      );
    } finally {
      setRequesting(false);
    }
  }

  // 4) Login required screen
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please log in to see your creator earnings & withdrawals.
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

  const balance = wallet ? wallet.balance : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-14">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-6 pb-4 sm:px-6">
        {/* top header / nav */}
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-[0.18em]">
              Creator on {BRAND.name}
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              Your earnings & withdrawals
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Track earnings and request payouts to your UPI.
            </p>
          </div>
          <a
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200"
          >
            ← Back to market
          </a>
        </header>

        {/* balance card */}
        <section className="mb-5">
          <div className="rounded-3xl border border-emerald-500/50 bg-gradient-to-r from-emerald-600/30 via-emerald-500/15 to-sky-500/20 px-4 py-4 shadow-xl shadow-emerald-900/40 backdrop-blur">
            <p className="text-xs text-emerald-100/90">Available balance (₹)</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-50">
              {loading ? "…" : balance.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-emerald-100/80">
              Gross: ₹0.00 • Paid: ₹0.00 • Pending: ₹0.00
            </p>
            <p className="mt-1 text-[10px] text-emerald-100/80">
              (For now this shows the same rupee wallet balance as your
              Genstrok wallet. Later we will separate creator earnings.)
            </p>
          </div>
        </section>

        {/* withdrawal form */}
        <section className="mb-6 rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 shadow-lg shadow-slate-950/70">
          <h2 className="text-sm font-semibold">Request payout to UPI</h2>
          <p className="mt-1 text-[11px] text-slate-400">
            We will (in future) send this amount from our Cashfree account to
            your UPI and update the status here. For now this is a demo flow.
          </p>

          <form onSubmit={handleRequestWithdrawal} className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">
                UPI ID
              </label>
              <input
                value={reqUpi}
                onChange={(e) => setReqUpi(e.target.value)}
                placeholder="yourname@upi"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">
                Amount (₹)
              </label>
              <input
                value={reqAmount}
                onChange={(e) => setReqAmount(e.target.value)}
                type="number"
                min={0}
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
              />
            </div>

            <button
              type="submit"
              disabled={requesting}
              className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {requesting ? "Sending request…" : "Request withdrawal"}
            </button>
          </form>

          <p className="mt-3 text-[10px] text-slate-500">
            In the real version, this will create a payout request, our backend
            will trigger Cashfree payout, and once it succeeds, your available
            balance will decrease.
          </p>
        </section>

        {/* withdrawal history placeholder (future) */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold">Withdrawal history</h2>
          <p className="mt-1 text-xs text-slate-400">
            No withdrawals yet. This section will show your past payout
            requests once we wire up real Cashfree payouts.
          </p>
        </section>
      </main>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-16 inset-x-0 flex justify-center z-50">
          <div className="rounded-full bg-slate-900/90 px-4 py-2 text-[11px] text-slate-100 border border-slate-700/70 shadow-lg shadow-black/60">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}