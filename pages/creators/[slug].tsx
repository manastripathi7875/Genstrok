// pages/creators/[slug].tsx
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { BRAND } from "../../lib/brand";

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  payout_upi?: string | null;
  payout_note?: string | null;
};

type ItemRow = {
  id: string;
  title: string;
  cover_url: string | null;
  price: number;
  stock: number;
  creator_name: string | null;
  creator_id: string | null;
};

type OwnershipRow = {
  item_id: string;
  coins: number | null;
};

export default function CreatorDetail() {
  const router = useRouter();
  const rawSlug = router.query.slug;

  const creatorSlug = useMemo(() => {
    if (!rawSlug) return "";
    try {
      return decodeURIComponent(String(rawSlug));
    } catch {
      return String(rawSlug);
    }
  }, [rawSlug]);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [claims, setClaims] = useState<OwnershipRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [editMode, setEditMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // full-screen drop action sheet state
  const [activeMenuItem, setActiveMenuItem] = useState<ItemRow | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // 1) Logged-in user
  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error(error);
        return;
      }
      if (data?.user) {
        setCurrentUser(data.user);
      }
    }
    loadUser();
  }, []);

  // 2) Items, creator profile, claims
  useEffect(() => {
    if (!creatorSlug) return;

    async function load() {
      setLoading(true);
      setProfileLoading(true);

      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id, title, cover_url, price, stock, creator_name, creator_id")
        .eq("creator_name", creatorSlug)
        .order("created_at", { ascending: false });

      if (itemError) {
        console.error(itemError);
        setItems([]);
        setClaims([]);
        setProfile(null);
        setCreatorId(null);
        setLoading(false);
        setProfileLoading(false);
        return;
      }

      const rows = (itemData || []) as ItemRow[];
      setItems(rows);

      const firstWithId = rows.find((r) => r.creator_id);
      if (firstWithId?.creator_id) {
        setCreatorId(firstWithId.creator_id);

        const { data: pData, error: pError } = await supabase
          .from("creator_profiles")
          .select("id, display_name, bio, avatar_url, payout_upi, payout_note")
          .eq("id", firstWithId.creator_id)
          .maybeSingle();

        if (pError && pError.code !== "PGRST116") {
          console.error(pError);
        } else if (pData) {
          setProfile(pData as Profile);
        } else {
          setProfile(null);
        }
      } else {
        setCreatorId(null);
        setProfile(null);
      }
      setProfileLoading(false);

      const ids = rows.map((r) => r.id);
      if (ids.length === 0) {
        setClaims([]);
        setLoading(false);
        return;
      }

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

      setLoading(false);
    }

    load();
  }, [creatorSlug]);

  // 3) Stats
  const stats = useMemo(() => {
    const drops = items.length;
    const totalStock = items.reduce((s, r) => s + (r.stock || 0), 0);
    const totalClaims = claims.length;
    const coins = claims.reduce((s, r) => s + (r.coins || 0), 0);
    return { drops, totalStock, totalClaims, coins };
  }, [items, claims]);

  const displayName = profile?.display_name || creatorSlug || "Creator";
  const displayBio = profile?.bio || `Early creator on ${BRAND.name}.`;

  // 4) Who can edit?
  const canEdit =
    !!currentUser && (!!creatorId ? creatorId === currentUser.id : true);

  // 5) Profile save
  async function handleSaveProfile(e: any) {
    e.preventDefault();
    if (!canEdit || !currentUser) return;

    const finalCreatorId = creatorId || currentUser.id;

    setSavingProfile(true);

    const payload: Profile = {
      id: finalCreatorId,
      display_name: (e.target.display_name.value as string).trim() || null,
      bio: (e.target.bio.value as string).trim() || null,
      avatar_url: (e.target.avatar_url.value as string).trim() || null,
      payout_upi: (e.target.payout_upi.value as string).trim() || null,
      payout_note: (e.target.payout_note.value as string).trim() || null,
    };

    const { error } = await supabase
      .from("creator_profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error(error);
    } else {
      setProfile(payload);
      setCreatorId(finalCreatorId);
      setEditMode(false);
    }
    setSavingProfile(false);
  }

  // 6) Drop-level actions used by bottom sheet

  function closeSheet() {
    setActiveMenuItem(null);
  }

  function handleEditDrop(id: string) {
    router.push(`/admin?drop=${encodeURIComponent(id)}`);
    closeSheet();
  }

  function handleAnalyticsDrop(id: string) {
    router.push(`/history?item=${encodeURIComponent(id)}`);
    closeSheet();
  }

  function handlePinDrop(id: string) {
    console.log("Pin/unpin drop (needs DB column):", id);
    closeSheet();
  }

  function handleVisibilityDrop(id: string) {
    console.log("Toggle public/private (needs DB column):", id);
    closeSheet();
  }

  async function handleDeleteDrop(item: ItemRow) {
    if (!canEdit) return;
    const ok = window.confirm(
      `Delete this drop?\n\nTitle: ${item.title}\nThis will remove it from the market.`
    );
    if (!ok) return;

    try {
      setDeleteLoadingId(item.id);
      const { error } = await supabase.from("items").delete().eq("id", item.id);

      if (error) {
        console.error("Delete drop error", error);
        alert("Failed to delete drop. Check console/logs.");
        return;
      }

      setItems((prev) => prev.filter((it) => it.id !== item.id));
      closeSheet();
    } finally {
      setDeleteLoadingId(null);
    }
  }

  // 7) UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
      {/* background gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pt-6 pb-4 sm:px-6">
        {/* top bar */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200"
          >
            ← Back
          </button>
          <span className="rounded-full border border-slate-800/80 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-300">
            Creator profile
          </span>
        </header>

        {/* creator profile strip */}
        <section className="mb-3 rounded-3xl border border-slate-800/80 bg-slate-950/85 px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => canEdit && setEditMode((v) => !v)}
            className={
              "h-11 w-11 overflow-hidden rounded-full bg-slate-800/80 flex items-center justify-center text-xs text-slate-200 border " +
              (canEdit ? "border-violet-500/70" : "border-slate-700/80")
            }
          >
            {profileLoading ? (
              <div className="h-full w-full animate-pulse bg-slate-800/80" />
            ) : profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{displayName.charAt(0).toUpperCase()}</span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-50 line-clamp-1">
              {displayName}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">
              {displayBio}
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="rounded-full border border-violet-500/70 bg-slate-950/80 px-3 py-1 text-[11px] text-violet-200"
            >
              {editMode ? "Close" : "Edit profile"}
            </button>
          )}
        </section>

        {/* inline edit form – creator only */}
        {canEdit && editMode && (
          <section className="mb-4 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-100">
              Edit creator profile
            </h2>
            <form onSubmit={handleSaveProfile} className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <label className="text-slate-300">Display name</label>
                <input
                  name="display_name"
                  defaultValue={profile?.display_name || displayName}
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">Avatar URL</label>
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
                  placeholder="Short intro about you and your creations."
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">Payout UPI (optional)</label>
                <input
                  name="payout_upi"
                  defaultValue={(profile as any)?.payout_upi || ""}
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                  placeholder="yourupi@bank"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">Payout note (optional)</label>
                <input
                  name="payout_note"
                  defaultValue={(profile as any)?.payout_note || ""}
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                  placeholder="Preferred payout details, timing, etc."
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
          </section>
        )}

        {/* stats cards */}
        <section className="mb-5 grid grid-cols-2 gap-2 text-[11px] text-slate-300 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
            <p className="text-slate-400">Drops</p>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {stats.drops}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
            <p className="text-slate-400">Total stock</p>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {stats.totalStock}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
            <p className="text-slate-400">Claims</p>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {stats.totalClaims}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
            <p className="text-slate-400">Coins earned</p>
            <p className="mt-1 text-sm font-semibold text-emerald-300">
              {stats.coins}
            </p>
          </div>
        </section>

        {/* items grid */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-100">
            Drops by {displayName}
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-2xl bg-slate-900/80"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-400">
              This creator has not listed any drops yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => {
                const imageSrc = item.cover_url?.trim()
                  ? item.cover_url
                  : `https://picsum.photos/seed/${item.id}/500`;
                const isOut = !item.stock || item.stock <= 0;
                const isOwner = canEdit;

                return (
                  <article
                    key={item.id}
                    className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80"
                  >
                    {/* three-dot icon */}
                    {isOwner && (
                      <div className="absolute right-1 top-1 z-20">
                        <button
                          type="button"
                          onClick={() => setActiveMenuItem(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/90 text-[14px] text-slate-200 border border-slate-700/80"
                        >
                          ⋯
                        </button>
                      </div>
                    )}

                    <div
                      className="relative h-28 w-full overflow-hidden cursor-pointer"
                      onClick={() =>
                        router.push(`/drop/${encodeURIComponent(item.id)}`)
                      }
                    >
                      <img
                        src={imageSrc}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] text-slate-100">
                        ₹{item.price}
                      </div>
                      <div
                        className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isOut
                            ? "bg-slate-800/90 text-slate-400"
                            : "bg-emerald-500/95 text-emerald-950"
                        }`}
                      >
                        {isOut ? "Sold out" : `Stock: ${item.stock ?? 0}`}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col px-3 py-2">
                      <h3 className="line-clamp-2 text-xs font-semibold text-slate-50">
                        {item.title}
                      </h3>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* FULL SCREEN GLASSMORPHISM ACTION SHEET */}
      {canEdit && activeMenuItem && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          {/* tap to close area */}
          <button
            className="flex-1 w-full"
            onClick={closeSheet}
            aria-label="Close actions"
          />

          <div className="max-h-[70vh] w-full rounded-t-3xl border border-slate-700/60 bg-slate-900/85 bg-opacity-80 backdrop-blur-2xl shadow-2xl shadow-black/60 px-4 pt-4 pb-6">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-600/60" />

            {/* header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/80">
                {activeMenuItem.cover_url ? (
                  <img
                    src={activeMenuItem.cover_url}
                    alt={activeMenuItem.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-300">
                    {BRAND.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-50 line-clamp-1">
                  Manage drop
                </p>
                <p className="text-[11px] text-slate-300 line-clamp-2">
                  {activeMenuItem.title}
                </p>
              </div>
              <button
                onClick={closeSheet}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-sm text-slate-200 border border-slate-700/80"
              >
                ×
              </button>
            </div>

            {/* actions */}
            <div className="space-y-2 text-[12px]">
              <button
                type="button"
                onClick={() => handleEditDrop(activeMenuItem.id)}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3 text-slate-100 border border-slate-700/70 active:scale-[0.99]"
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold">Edit drop</span>
                  <span className="text-[11px] text-slate-400">
                    Change title, price, stock or cover
                  </span>
                </div>
                <span className="text-lg">✏️</span>
              </button>

              <button
                type="button"
                onClick={() => handleAnalyticsDrop(activeMenuItem.id)}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3 text-slate-100 border border-slate-700/70 active:scale-[0.99]"
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold">Analytics</span>
                  <span className="text-[11px] text-slate-400">
                    View claims, coins earned and history
                  </span>
                </div>
                <span className="text-lg">📊</span>
              </button>

              <button
                type="button"
                onClick={() => handleVisibilityDrop(activeMenuItem.id)}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3 text-slate-100 border border-slate-700/70 active:scale-[0.99]"
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold">Public / private</span>
                  <span className="text-[11px] text-slate-400">
                    Toggle visibility on the market
                  </span>
                </div>
                <span className="text-lg">🌐</span>
              </button>

              <button
                type="button"
                onClick={() => handlePinDrop(activeMenuItem.id)}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3 text-slate-100 border border-slate-700/70 active:scale-[0.99]"
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold">Pin on top</span>
                  <span className="text-[11px] text-slate-400">
                    Highlight this drop on your profile
                  </span>
                </div>
                <span className="text-lg">📌</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteDrop(activeMenuItem)}
                disabled={deleteLoadingId === activeMenuItem.id}
                className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-rose-700/90 to-red-600/90 px-4 py-3 text-slate-50 border border-rose-500/80 active:scale-[0.99] disabled:opacity-70"
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold">
                    {deleteLoadingId === activeMenuItem.id
                      ? "Deleting…"
                      : "Delete drop"}
                  </span>
                  <span className="text-[11px] text-rose-100/90">
                    This action is permanent
                  </span>
                </div>
                <span className="text-lg">🗑️</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}