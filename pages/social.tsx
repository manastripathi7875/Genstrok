import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type FeedRow = {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_avatar: string | null;
  action_type: "follow" | "claim";
  target_type: "creator" | "drop";
  target_id: string;
  meta: any;
  created_at: string;
};

export default function SocialFeedPage() {
  const router = useRouter();
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeed() {
      setLoading(true);

      const { data, error } = await supabase
        .from("activity_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Feed load error", error);
        setFeed([]);
      } else {
        setFeed((data || []) as FeedRow[]);
      }

      setLoading(false);
    }

    loadFeed();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-16">
      {/* header */}
      <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <h1 className="text-sm font-semibold">🌍 Global Activity</h1>
        <p className="text-[11px] text-slate-400">
          What people are doing on {BRAND.name}
        </p>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-3">
        {loading ? (
          <p className="text-xs text-slate-400">Loading activity…</p>
        ) : feed.length === 0 ? (
          <p className="text-xs text-slate-400">
            No activity yet. Be the first one 👀
          </p>
        ) : (
          feed.map((row) => (
            <ActivityCard
              key={row.id}
              row={row}
              onOpenCreator={(slug) =>
                router.push(`/creators/${encodeURIComponent(slug)}`)
              }
              onOpenDrop={(id) => router.push(`/drop/${id}`)}
            />
          ))
        )}
      </main>
    </div>
  );
}

/* ---------------- CARD COMPONENT ---------------- */

function ActivityCard({
  row,
  onOpenCreator,
  onOpenDrop,
}: {
  row: FeedRow;
  onOpenCreator: (slug: string) => void;
  onOpenDrop: (id: string) => void;
}) {
  function renderText() {
    if (row.action_type === "follow") {
      return (
        <>
          <b>{row.actor_name}</b> followed a creator
        </>
      );
    }

    if (row.action_type === "claim") {
      return (
        <>
          <b>{row.actor_name}</b> claimed{" "}
          <b>{row.meta?.title || "a drop"}</b>
        </>
      );
    }

    return "Unknown activity";
  }

  function handleClick() {
    if (row.action_type === "follow" && row.meta?.creator_slug) {
      onOpenCreator(row.meta.creator_slug);
    }
    if (row.action_type === "claim") {
      onOpenDrop(row.target_id);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 flex gap-3 hover:bg-slate-900 transition"
    >
      <div className="h-9 w-9 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-xs">
        {row.actor_avatar ? (
          <img
            src={row.actor_avatar}
            alt={row.actor_name}
            className="h-full w-full object-cover"
          />
        ) : (
          row.actor_name.charAt(0).toUpperCase()
        )}
      </div>

      <div className="flex-1">
        <p className="text-[12px] text-slate-200">{renderText()}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          {new Date(row.created_at).toLocaleString()}
        </p>
      </div>
    </button>
  );
}