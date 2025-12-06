import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type ItemRow = {
  id: string;
  title: string;
  price: number;
  stock: number;
  cover_url: string | null;
};

type ClaimRow = {
  id: string;
  item_id: string;
  coins: number | null;
  created_at: string;
};

type WithdrawalRow = {
  id: string;
  amount: number;
  upi_id: string | null;
  status: string;
  created_at: string;
};

export default function CreatorDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [upiId, setUpiId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [toast, setToast] = useState<string | null>(null);
async function handleLogout() {
    // Supabase se logout
    await supabase.auth.signOut();

    // User ko auth / login page pe bhejo
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
}
  // auto hide toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  // load user + data
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      const u = data.user;
      setUser(u);

      // 1) creator ke sare items
      const { data: itemsData, error: itemsErr } = await supabase
        .from("items")
        .select("id, title, price, stock, cover_url")
        .eq("creator_id", u.id);

      if (itemsErr) {
        console.error(itemsErr);
        setItems([]);
      } else {
        setItems((itemsData || []) as ItemRow[]);
      }

      const itemIds = (itemsData || []).map((it: any) => it.id);

      // 2) in items pe aaye huye sare claims
      if (itemIds.length > 0) {
        const { data: claimsData, error: claimsErr } = await supabase
          .from("ownerships")
          .select("id, item_id, coins, created_at")
          .in("item_id", itemIds);

        if (claimsErr) {
          console.error(claimsErr);
          setClaims([]);
        } else {
          setClaims((claimsData || []) as ClaimRow[]);
        }
      } else {
        setClaims([]);
      }

      // 3) creator ke withdrawal requests
      const { data: wdData, error: wdErr } = await supabase
        .from("withdrawals")
        .select("id, amount, upi_id, status, created_at")
        .eq("creator_id", u.id)
        .order("created_at", { ascending: false });

      if (wdErr) {
        console.error(wdErr);
        setWithdrawals([]);
      } else {
        setWithdrawals((wdData || []) as WithdrawalRow[]);
      }

      setLoading(false);
    }

    load();
  }, []);

  // stats calculate
  const totalDrops = items.length;

  // itemId -> price map
  const priceById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) {
      m[it.id] = it.price;
    }
    return m;
  }, [items]);

  const totalClaims = claims.length;

  const totalCoinsEarned = useMemo(
    () => claims.reduce((sum, c) => sum + (c.coins || 0), 0),
    [claims]
  );

  const grossRevenue = useMemo(
    () =>
      claims.reduce(
        (sum, c) => sum + (priceById[c.item_id] || 0),
        0
      ),
    [claims, priceById]
  );

  const totalWithdrawn = useMemo(
    () =>
      withdrawals
        .filter((w) => w.status === "paid")
        .reduce((sum, w) => sum + w.amount, 0),
    [withdrawals]
  );

  const totalPending = useMemo(
    () =>
      withdrawals
        .filter((w) => w.status === "pending")
        .reduce((sum, w) => sum + w.amount, 0),
    [withdrawals]
  );

  const availableBalance = Math.max(
    grossRevenue - totalWithdrawn - totalPending,
    0
  );

  async function handleCreateWithdrawal() {
    if (!user) return;
    const amtNum = Number(withdrawAmount);

    if (!amtNum || amtNum <= 0) {
      setToast("Enter a valid amount.");
      return;
    }
    if (amtNum > availableBalance) {
      setToast("Amount is more than available balance.");
      return;
    }
    if (!upiId.trim()) {
      setToast("Enter your UPI ID (example: name@upi).");
      return;
    }

    setWithdrawLoading(true);

    const { error } = await supabase.from("withdrawals").insert({
      creator_id: user.id,
      creator_email: user.email,
      amount: amtNum,
      upi_id: upiId.trim(),
      status: "pending",
    });

    if (error) {
      console.error(error);
      setToast("Error creating withdrawal request.");
      setWithdrawLoading(false);
      return;
    }

    setToast(
      "Withdrawal requested! We will process it to your UPI soon."
    );
    setWithdrawAmount("");

    // refresh list
    const { data: wdData } = await supabase
      .from("withdrawals")
      .select("id, amount, upi_id, status, created_at")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });

    setWithdrawals((wdData || []) as WithdrawalRow[]);
    setWithdrawLoading(false);
  }

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-semibold">
          Creator dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Please log in to view your earnings.
        </p>
        <a
          href="/auth"
          className="mt-4 rounded-xl bg-violet-500 px-4 py-2 text-sm text-slate-950"
        >
          Login →
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-16">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-5 pb-10 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Creator on {BRAND.name}
            </p>
            <h1 className="text-xl font-semibold text-slate-50">
              Your earnings & withdrawals
            </h1>
            <p className="mt-1 text-[11px] text-slate-400">
              Track how your drops are performing and request payouts to
              your UPI.
            </p>
          </div>
        
              <button
                onClick={handleLogout}
                className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-200"
              >
                Logout
              </button>
              <a
                href="/"
                className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-200"
              >
            ← Back
          </a>
        </header>

        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          <>
            {/* Stats Cards */}
            <section className="mb-5 grid gap-3 text-[11px] sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                <p className="text-slate-400">Drops</p>
                <p className="mt-1 text-xl font-semibold">
                  {totalDrops}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                <p className="text-slate-400">Total claims</p>
                <p className="mt-1 text-xl font-semibold">
                  {totalClaims}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                <p className="text-slate-400">
                  {BRAND.coinName} earned
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {totalCoinsEarned}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-600/60 bg-emerald-500/10 px-3 py-3">
                <p className="text-slate-200">Available balance (₹)</p>
                <p className="mt-1 text-xl font-semibold text-emerald-300">
                  {availableBalance.toFixed(2)}
                </p>
                <p className="mt-1 text-[10px] text-emerald-200/80">
                  Gross: ₹{grossRevenue.toFixed(2)} • Paid: ₹
                  {totalWithdrawn.toFixed(2)} • Pending: ₹
                  {totalPending.toFixed(2)}
                </p>
              </div>
            </section>

            {/* Withdrawal form */}
            <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-950/90 p-4 text-[11px]">
              <h2 className="text-sm font-semibold">
                Request payout to UPI
              </h2>
              <p className="mt-1 text-[10px] text-slate-400">
                We will send this amount from our Cashfree account to
                your UPI and update the status here.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-slate-300">
                    UPI ID
                  </p>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-100 outline-none focus:border-violet-500"
                    placeholder="yourname@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-300">
                    Amount (₹)
                  </p>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-100 outline-none focus:border-violet-500"
                    type="number"
                    placeholder="0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={handleCreateWithdrawal}
                disabled={withdrawLoading}
                className="mt-4 rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {withdrawLoading
                  ? "Requesting…"
                  : "Request withdrawal"}
              </button>
            </section>

            {/* Withdrawal history */}
            <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 text-[11px]">
              <h2 className="text-sm font-semibold">
                Withdrawal history
              </h2>

              {withdrawals.length === 0 ? (
                <p className="mt-2 text-[10px] text-slate-400">
                  No withdrawals yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2"
                    >
                      <div>
                        <p className="text-[11px]">
                          ₹{w.amount.toFixed(2)} •{" "}
                          <span
                            className={
                              w.status === "paid"
                                ? "text-emerald-400"
                                : w.status === "rejected"
                                ? "text-red-400"
                                : "text-amber-300"
                            }
                          >
                            {w.status}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {new Date(w.created_at).toLocaleString()} • UPI:{" "}
                          {w.upi_id || "-"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {toast && (
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-4">
          <div className="max-w-sm rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 shadow-lg shadow-emerald-900/40">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}