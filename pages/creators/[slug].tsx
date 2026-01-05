import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { BRAND } from "../../lib/brand";

/* ================= TYPES ================= */

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

/* ================= PAGE ================= */

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

  /* -------- core state -------- */

  const [items, setItems] = useState<ItemRow[]>([]);
  const [claims, setClaims] = useState<OwnershipRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [editMode, setEditMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  /* -------- follow state -------- */

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  /* ================= AUTH ================= */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUser(data.user);
    });
  }, []);

  /* ================= LOAD CREATOR DATA ================= */

  useEffect(() => {
    if (!creatorSlug) return;

    async function load() {
      setLoading(true);
      setProfileLoading(true);

      const { data: itemData } = await supabase
        .from("items")
        .select("id, title, cover_url, price, stock, creator_name, creator_id")
        .eq("creator_name", creatorSlug)
        .order("created_at", { ascending: false });

      const rows = (itemData || []) as ItemRow[];
      setItems(rows);

      const first = rows.find((r) => r.creator_id);
      if (first?.creator_id) {
        setCreatorId(first.creator_id);

        const { data: pData } = await supabase
          .from("creator_profiles")
          .select("id, display_name, bio, avatar_url, payout_upi, payout_note")
          .eq("id", first.creator_id)
          .maybeSingle();

        if (pData) setProfile(pData);
      }

      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { data: claimData } = await supabase
          .from("ownerships")
          .select("item_id, coins")
          .in("item_id", ids);

        setClaims((claimData || []) as OwnershipRow[]);
      }

      setProfileLoading(false);
      setLoading(false);
    }

    load();
  }, [creatorSlug]);

  /* ================= FOLLOW STATE ================= */

  useEffect(() => {
    if (!creatorId) return;

    async function loadFollow() {
      const { count } = await supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", creatorId);

      setFollowersCount(count || 0);

      if (currentUser && currentUser.id !== creatorId) {
        const { data } = await supabase
          .from("user_follows")
          .select("id")
          .eq("following_id", creatorId)
          .eq("follower_id", currentUser.id)
          .maybeSingle();

        setIsFollowing(!!data);
      }
    }

    loadFollow();
  }, [creatorId, currentUser]);

  /* ================= FOLLOW ACTION ================= */

  async function handleFollow() {
    if (!currentUser || !creatorId) return;
    if (currentUser.id === creatorId) return;

    if (isFollowing) {
      await supabase
        .from("user_follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", creatorId);

      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("user_follows").insert({
        follower_id: currentUser.id,
        following_id: creatorId,
      });
      await supabase.from("activity_feed").insert({
  actor_id: currentUser.id,
  actor_name: currentUser.user_metadata?.name || currentUser.email,
  actor_avatar: currentUser.user_metadata?.avatar_url || null,
  action_type: "follow",
  target_type: "user",
  target_id: creatorId,
        meta: {
      creator_slug: creatorSlug,
    },
});
await supabase.from("notifications").insert({
  buyer_id: creatorId, // jis ko follow kiya gaya
  title: "New follower 👋",
  body: `${currentUser.user_metadata?.name || "Someone"} started following you`,
  link: `/creators/${encodeURIComponent(
    currentUser.user_metadata?.name || ""
  )}`,
});
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
    }
  }

  /* ================= STATS ================= */

  const stats = useMemo(() => {
    const drops = items.length;
    const totalStock = items.reduce((s, r) => s + (r.stock || 0), 0);
    const totalClaims = claims.length;
    const coins = claims.reduce((s, r) => s + (r.coins || 0), 0);

    const trustScore = Math.min(
      100,
      Math.floor((coins / 1000) + items.length * 2)
    );

    const trust =
      trustScore > 70 ? "High Trust" :
      trustScore > 30 ? "Growing" :
      "New";

  return {
    drops,
    totalStock,
    totalClaims,
    coins,
    trust: trust, 
    trustScore,
    };
    }, [items, claims]);

  const displayName = profile?.display_name || creatorSlug || "Creator";
    
  const displayBio = profile?.bio || `Active creator on ${BRAND.name}.`;


  const canEdit =
    !!currentUser && !!creatorId && currentUser.id === creatorId;
  const isOwner =
    !!currentUser && !!creatorId && currentUser.id === creatorId;

  /* ================= SAVE PROFILE ================= */
function handleOpenSettings() {
  router.push("/creator-settings"); // global settings page
}
  async function handleSaveProfile(e: any) {
    e.preventDefault();
    if (!canEdit || !creatorId) return;

    setSavingProfile(true);

    const payload: Profile = {
      id: creatorId,
      display_name: e.target.display_name.value || null,
      bio: e.target.bio.value || null,
      avatar_url: e.target.avatar_url.value || null,
    };

    await supabase
      .from("creator_profiles")
      .upsert(payload, { onConflict: "id" });

    setProfile(payload);
    setEditMode(false);
    setSavingProfile(false);
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
      <main className="mx-auto max-w-5xl px-4 pt-6">
        {/* header */}
        <header className="mb-4 flex justify-between items-center">
          <button onClick={() => router.back()} className="text-xs">
            ← Back
          </button>
        </header>

        {/* profile header */}
        <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-950/90 p-5">
          
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
  <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1">
              <h1 className="font-semibold">{displayName}</h1>
              <p className="text-xs text-slate-400">{displayBio}</p>
              <p className="mt-1 text-[11px] text-emerald-400">
                {stats.trust} • Trust score {stats.trustScore}/100
              </p>
            </div>
         </div>
                  <div className="flex flex-col items-end gap-2">

          {/* FOLLOW / EDIT */}
            {currentUser && creatorId && currentUser.id !== creatorId && (
      <div className="mt-3">
              <button
                onClick={handleFollow}
                className={ `rounded-full px-4 py-1.5 text-[11px] font-semibold ${
                  isFollowing
                    ? "border border-slate-600 text-slate-300"
                    : "bg-violet-500 text-slate-950"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
      <p className="mt-1 text-[10px] text-slate-500">
    💬 Chat & work offers coming soon
    </p>
  </div>
)}
            
            {!creatorId && (
  <span className="text-[11px] text-slate-400">
    Unverified profile
  </span>
)}

            {/* EDIT PROFILE – only own creator profile */}
            {currentUser && creatorId && currentUser.id === creatorId && (
              <button
                onClick={() => setEditMode((v) => !v)}
                className="rounded-full border border-violet-500/70 px-3 py-1 text-[11px] text-violet-200"
              >
                {editMode ? "Close" : "Edit profile"}
              </button>
            )}

            {/* GLOBAL SETTINGS – always for logged-in user */}
            {currentUser && (
              <button
                onClick={handleOpenSettings}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-950/80 text-[15px] text-slate-200"
                aria-label="Settings"
              >
                ☰
              </button>
            )}
          </div>
    </div>
    
        </section>

        {/* stats */}
        <section className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Stat label="Drops" value={stats.drops} />
          <Stat label="Stock" value={stats.totalStock} />
          <Stat
            label="Est. Earnings ₹"
            value={Math.floor(stats.coins / 100)}
          />
          <Stat label="Coins" value={stats.coins} highlight />
          <Stat label="Followers" value={followersCount} />
        </section>

        {/* drops */}
        <section>
          <h2 className="mb-3 text-sm font-semibold">
            Drops by {displayName}
          </h2>

          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-400">No drops yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                  {/* OWNER ONLY: EDIT / DELETE */}
    {isOwner && (
      <div className="absolute right-2 top-2 z-10 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/drop/edit/${item.id}`);
          }}
          className="rounded-full bg-black/70 px-2 py-1 text-[11px] text-white"
        >
          ✏️
        </button>

        <button
          onClick={async (e) => {
            e.stopPropagation();
            const ok = confirm("Delete this drop?");
            if (!ok) return;

            await supabase
              .from("items")
              .delete()
              .eq("id", item.id)
              .eq("creator_id", creatorId);

            setItems((prev) =>
              prev.filter((i) => i.id !== item.id)
            );
          }}
          className="rounded-full bg-red-600 px-2 py-1 text-[11px] text-white"
        >
          🗑️
        </button>
      </div>
    )}

    {/* DROP CARD */}
    <div
                  onClick={() =>
                    router.push(`/drop/${encodeURIComponent(item.id)}`)
                  }
                  className="cursor-pointer rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 hover:scale-[1.01] transition"
                >
                  <img
                    src={
                      item.cover_url ||
                      `https://picsum.photos/seed/${item.id}/400`
                    }
                    className="h-32 w-full object-cover"
                  />
                  <div className="p-3 text-xs">
                    <p className="font-semibold line-clamp-2">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      ₹{item.price} • Stock {item.stock}
            </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </main>
              </div>
            );
          }

/* ================= STAT CARD ================= */

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        highlight
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
          : "border-slate-800 bg-slate-950 text-slate-300"
      }`}
    >
      <p className="text-[11px] opacity-70">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}