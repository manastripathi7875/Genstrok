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
  const rawName = router.query.name;

  const creatorName = useMemo(() => {
    if (!rawName) return "";
    try {
      return decodeURIComponent(String(rawName));
    } catch {
      return String(rawName);
    }
  }, [rawName]);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [claims, setClaims] = useState<OwnershipRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [editMode, setEditMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // 🔹 1) Logged-in user lao
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

  // 🔹 2) Items, creator profile, claims
  useEffect(() => {
    if (!creatorName) return;

    async function load() {
      setLoading(true);
      setProfileLoading(true);

      // 2.1 – Items jaha creator_name match ho
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select(
          "id, title, cover_url, price, stock, creator_name, creator_id"
        )
        .eq("creator_name", creatorName)
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

      // 2.2 – creator_id pakdo (agar kisi item me ho)
      const firstWithId = rows.find((r) => r.creator_id);
      if (firstWithId?.creator_id) {
        setCreatorId(firstWithId.creator_id);

        // 2.3 – creator_profiles se public data lao
        const { data: pData, error: pError } = await supabase
          .from("creator_profiles")
          .select(
            "id, display_name, bio, avatar_url, payout_upi, payout_note"
          )
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
        // koi creator_id nahi (purane items)
        setCreatorId(null);
        setProfile(null);
      }
      setProfileLoading(false);

      // 2.4 – ownerships (claims)
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
  }, [creatorName]);

  // 🔹 3) Stats
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

  const displayName =
    profile?.display_name || creatorName || "Creator";

  const displayBio =
    profile?.bio || `Early creator on ${BRAND.name}.`;

  // 🔹 4) Kaun edit kar sakta hai?
  // - Agar creatorId hai → sirf wohi user jiska id match
  // - Agar creatorId null hai (old drops) → koi bhi logged-in user
  const canEdit =
    !!currentUser &&
    (!!creatorId ? creatorId === currentUser.id : true);

  // 🔹 5) Profile save
  async function handleSaveProfile(e: any) {
    e.preventDefault();
    if (!canEdit || !currentUser) return;

    const finalCreatorId = creatorId || currentUser.id;

    setSavingProfile(true);

    const payload: Profile = {
      id: finalCreatorId,
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
      setProfile(payload);
      setCreatorId(finalCreatorId);
      setEditMode(false);
    }
    setSavingProfile(false);
  }

  // 🔹 6) UI
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
              (canEdit
                ? "border-violet-500/70"
                : "border-slate-700/80")
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
              <span>
                {displayName.charAt(0).toUpperCase()}
              </span>
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
            <form
              onSubmit={handleSaveProfile}
              className="space-y-3 text-[11px]"
            >
              <div className="space-y-1">
                <label className="text-slate-300">
                  Display name
                </label>
                <input
                  name="display_name"
                  defaultValue={profile?.display_name || displayName}
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">
                  Avatar URL
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
                  placeholder="Short intro about you and your creations."
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">
                  Payout UPI (optional)
                </label>
                <input
                  name="payout_upi"
                  defaultValue={(profile as any)?.payout_upi || ""}
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

                return (
                  <article
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80"
                  >
                    <div className="relative h-28 w-full overflow-hidden">
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
    </div>
  );
}