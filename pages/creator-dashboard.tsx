import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  payout_upi: string | null;
  payout_note: string | null;
};

type ItemRow = {
  id: string;
  title: string;
  price: number;
  stock: number;
};

type OwnershipRow = {
  item_id: string;
  coins: number | null;
};

export default function CreatorDashboard() {
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [claims, setClaims] = useState<OwnershipRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // 1) Load current user, profile, items, claims
  useEffect(() => {
    async function init() {
      // current user
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        console.error(authError);
        setNeedsLogin(true);
        setProfileLoading(false);
        setLoadingItems(false);
        return;
      }

      const u = authData?.user;
      if (!u) {
        setNeedsLogin(true);
        setProfileLoading(false);
        setLoadingItems(false);
        return;
      }

      setUser(u);

      // profile
      setProfileLoading(true);
      const { data: pData, error: pError } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (pError && pError.code !== "PGRST116") {
        console.error(pError);
      }
      setProfile(pData as Profile | null);
      setProfileLoading(false);

      // items
      setLoadingItems(true);
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id, title, price, stock")
        .eq("creator_id", u.id)
        .order("created_at", { ascending: false });

      if (itemError) {
        console.error(itemError);
        setItems([]);
        setClaims([]);
        setLoadingItems(false);
        return;
      }

      const rows = (itemData || []) as ItemRow[];
      setItems(rows);

      const ids = rows.map((r) => r.id);
      if (ids.length === 0) {
        setClaims([]);
        setLoadingItems(false);
        return;
      }

      // claims for these items
      const { data: claimData, error: claimError } = await supabase
        .from("ownerships")
        .select("item_id, coins")
        .in("item_id", ids);

      if (claimError) {
        console.error(claimError);
        setClaims([]);
      } else {
        setClaims((claimData || []) as OwnershipRow[]);
      }

      setLoadingItems(false);
    }

    init();
  }, []);

  // 2) Derived stats
  const stats = useMemo(() => {
    const drops = items.length;
    const totalStock = items.reduce(
      (s, r) => s + (r.stock || 0),
      0
    );
    const totalClaims = claims.length;
    const coins = claims.reduce(
      (s, r) => s + (r.coins || 0),
      0
    );
    return { drops, totalStock, totalClaims, coins };
  }, [items, claims]);

  async function handleSaveProfile(e: any) {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);

    const payload = {
      id: user.id,
      display_name:
        (e.target.display_name.value as string).trim() || null,
      bio: (e.target.bio.value as string).trim() || null,
      avatar_url:
        (e.target.avatar_url.value as string).trim() || null,
      payout_upi:
        (e.target.payout_upi.value as string).trim() || null,
      payout_note:
        (e.target.payout_note.value as string).trim() || null,
    };

    const { error } = await supabase
      .from("creator_profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error(error);
    } else {
      setProfile(payload as Profile);
    }
    setSavingProfile(false);
  }

  // 3) Login required screen
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">
            Creator dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Log in to manage your creator profile and drops.
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

  // 4) MAIN UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-6 pb-6 sm:px-6">
        {/* top bar */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
              Creator Studio
            </p>
            <h1 className="text-xl font-semibold text-slate-50">
              {BRAND.name} creator dashboard
            </h1>
            <p className="mt-1 text-[11px] text-slate-400">
              See your drops performance and set up payouts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/admin"
              className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200"
            >
              Open admin →
            </a>
            <a
              href="/"
              className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200"
            >
              Home
            </a>
          </div>
        </header>

        {/* stats row */}
        <section className="mb-6 grid grid-cols-2 gap-2 text-[11px] text-slate-300 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/85 px-3 py-2">
            <p className="text-slate-400">Drops</p>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {stats.drops}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/85 px-3 py-2">
            <p className="text-slate-400">Total stock</p>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {stats.totalStock}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/85 px-3 py-2">
            <p className="text-slate-400">Claims</p>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {stats.totalClaims}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/85 px-3 py-2">
            <p className="text-slate-400">Coins earned</p>
            <p className="mt-1 text-sm font-semibold text-emerald-300">
              {stats.coins}
            </p>
          </div>
        </section>

        {/* 2 column layout: left profile, right performance */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
          {/* LEFT: PROFILE CARD */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/85 p-4 shadow-md shadow-slate-950/60">
            <h2 className="mb-3 text-sm font-semibold text-slate-100">
              Creator profile
            </h2>

            {profileLoading ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : (
              <form
                onSubmit={handleSaveProfile}
                className="space-y-3 text-[11px]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-800/80 flex items-center justify-center text-xs text-slate-300">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {profile?.display_name
                          ? profile.display_name.charAt(0).toUpperCase()
                          : (user?.email || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] text-slate-400">
                      Public display name
                    </p>
                    <input
                      name="display_name"
                      defaultValue={
                        profile?.display_name || user?.email || ""
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">
                    Avatar URL (optional)
                  </label>
                  <input
                    name="avatar_url"
                    defaultValue={profile?.avatar_url || ""}
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                    placeholder="https://image-link.jpg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">Bio</label>
                  <textarea
                    name="bio"
                    defaultValue={profile?.bio || ""}
                    rows={3}
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                    placeholder="Tell buyers who you are and what you create."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">
                    Payout UPI (optional)
                  </label>
                  <input
                    name="payout_upi"
                    defaultValue={profile?.payout_upi || ""}
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                    placeholder="yourupi@bank"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">
                    Payout note (optional)
                  </label>
                  <input
                    name="payout_note"
                    defaultValue={profile?.payout_note || ""}
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                    placeholder="Preferred payout timing, instructions, etc."
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
                  >
                    {savingProfile ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* RIGHT: DROPS PERFORMANCE */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/85 p-4 shadow-md shadow-slate-950/60">
            <h2 className="mb-3 text-sm font-semibold text-slate-100">
              Your drops performance
            </h2>

            {loadingItems ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-slate-400">
                You haven&apos;t added any drops yet. Use the admin
                panel to create your first drop.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const itemClaims = claims.filter(
                    (c) => c.item_id === item.id
                  );
                  const itemCoins = itemClaims.reduce(
                    (s, c) => s + (c.coins || 0),
                    0
                  );

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/90 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-50 line-clamp-1">
                          {item.title}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          ₹{item.price} • Stock {item.stock} •{" "}
                          {itemClaims.length} claims
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">
                          Coins
                        </div>
                        <div className="text-sm font-semibold text-emerald-300">
                          {itemCoins}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}