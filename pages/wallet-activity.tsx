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

  // simple toast
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

  // 2) realtime wallet updates
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
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 3) fake withdrawal request demo
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
      showToast(
        `Withdrawal request created (₹${amount}) - demo mode only, no real money.`
      );
    } finally {
      setRequesting(false);
    }
  }

  // 4) login required screen
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Creator wallet
          </p>
          <h1 className="mt-2 text-xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to access your {BRAND.name} earnings, balance and payouts.
          </p>
          <a
            href="/auth"
            className="mt-5 inline-flex rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-400"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  const balance = wallet ? wallet.balance : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute inset-x-10 top-40 h-px bg-gradient-to-r from-transparent via-slate-700/60 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {/* top bar */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[11px] font-medium text-slate-300">
                Creator wallet
              </p>
              <span className="text-[11px] text-slate-500">
                {BRAND.name} sandbox
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-tight">
              Your earnings and withdrawals
            </h1>
            <p className="text-xs text-slate-400">
              Monitor live balance and route payouts directly to your UPI.
            </p>
          </div>

          <a
            href="/"
            className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900/80"
          >
            <span className="text-lg leading-none">←</span>
            Back to market
          </a>
        </header>

        {/* back link for mobile */}
        <a
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-[11px] text-slate-400 sm:hidden"
        >
          <span className="text-base leading-none">←</span>
          Back to market
        </a>

        {/* main grid */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* balance and metrics */}
          <section className="space-y-4">
            {/* balance card */}
            <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-600/35 via-slate-900/95 to-sky-500/25 px-4 py-4 sm:px-5 sm:py-5 shadow-xl shadow-emerald-900/40 backdrop-blur">
              <div className="absolute right-4 top-4 rounded-full border border-emerald-400/40 bg-slate-950/40 px-2.5 py-1 text-[10px] text-emerald-100/90">
                Wallet in preview mode
              </div>

              <p className="text-[11px] text-emerald-100/80">
                Available balance
              </p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-base text-emerald-100/80">₹</span>
                <p className="text-3xl font-semibold text-emerald-50 tracking-tight">
                  {loading ? "..." : balance.toFixed(2)}
                </p>
              </div>

              <p className="mt-2 text-[11px] text-emerald-100/80">
                This mirrors your main {BRAND.name} wallet. Creator earnings and
                other streams will be separated in a later release.
              </p>

              {/* mini metrics */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-2xl bg-slate-950/40 px-3 py-2 border border-emerald-500/20">
                  <p className="text-emerald-100/80">Gross</p>
                  <p className="mt-0.5 font-semibold text-emerald-50">
                    ₹0.00
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/40 px-3 py-2 border border-slate-700/50">
                  <p className="text-slate-200/90">Paid out</p>
                  <p className="mt-0.5 font-semibold text-slate-50">₹0.00</p>
                </div>
                <div className="rounded-2xl bg-slate-950/40 px-3 py-2 border border-sky-500/30">
                  <p className="text-sky-100/90">Pending</p>
                  <p className="mt-0.5 font-semibold text-sky-50">₹0.00</p>
                </div>
              </div>
            </div>

            {/* history block */}
            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 sm:px-5 sm:py-5 shadow-lg shadow-slate-950/70">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Withdrawal history</h2>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Track every payout as it moves from Genstrok to your UPI.
                  </p>
                </div>
                <span className="rounded-full border border-slate-800 px-2.5 py-1 text-[10px] text-slate-400">
                  Coming soon
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-center text-[11px] text-slate-500">
                No withdrawals yet. Once real Cashfree payouts are wired in,
                this feed will show status, timestamps and reference IDs.
              </div>
            </section>
          </section>

          {/* payout form */}
          <section className="rounded-3xl border border-slate-800/80 bg-slate-950/90 px-4 py-4 sm:px-5 sm:py-5 shadow-lg shadow-slate-950/80 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Request payout to UPI</h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Configure the UPI handle and amount to simulate a payout.
                  Live money rails will be attached in a later phase.
                </p>
              </div>
              <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] text-slate-400 border border-slate-800">
                Demo only
              </span>
            </div>

            <form
              onSubmit={handleRequestWithdrawal}
              className="mt-4 space-y-3 text-xs"
            >
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>UPI ID</span>
                  <span className="text-[10px] text-slate-500">
                    Example: yourname@upi
                  </span>
                </label>
                <input
                  value={reqUpi}
                  onChange={(e) => setReqUpi(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Amount (₹)</span>
                  <span className="text-[10px] text-slate-500">
                    Up to your available balance
                  </span>
                </label>
                <input
                  value={reqAmount}
                  onChange={(e) => setReqAmount(e.target.value)}
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                />
              </div>

              <button
                type="submit"
                disabled={requesting}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {requesting ? "Sending request..." : "Request withdrawal"}
              </button>
            </form>

            <p className="mt-3 text-[10px] text-slate-500">
              In the real version this form will create a payout record,
              trigger Cashfree from the backend and update the balance once the
              transfer clears.
            </p>
          </section>
        </div>
      </main>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-16 inset-x-0 z-50 flex justify-center px-4">
          <div className="rounded-full bg-slate-900/95 px-4 py-2 text-[11px] text-slate-100 border border-slate-700/80 shadow-lg shadow-black/60">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}