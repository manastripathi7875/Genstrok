import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Activity = {
  id: string;
  actor_name: string | null;
  actor_avatar: string | null;
  action_type: string;
  meta: any;
  created_at: string;
};

export default function FeedPage() {
  const [feed, setFeed] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("activity_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      setFeed((data || []) as Activity[]);
      setLoading(false);
    }

    load();
  }, []);

  function renderText(a: Activity) {
    switch (a.action_type) {
      case "follow":
        return "followed a creator";
      case "claim":
        return `earned ${a.meta?.coins || 0} coins`;
      case "drop_created":
        return `launched a new drop`;
      default:
        return "did something";
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 pt-6">
      <h1 className="mb-4 text-lg font-semibold">Global Activity</h1>

      {loading ? (
        <p className="text-xs text-slate-400">Loading feed…</p>
      ) : (
        <div className="space-y-3">
          {feed.map((a) => (
            <div
              key={a.id}
              className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3"
            >
              <div className="h-10 w-10 rounded-full bg-slate-800 overflow-hidden">
                {a.actor_avatar ? (
                  <img
                    src={a.actor_avatar}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs">
                    {a.actor_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
              </div>

              <div className="flex-1 text-xs">
                <p>
                  <span className="font-semibold">
                    {a.actor_name || "User"}
                  </span>{" "}
                  {renderText(a)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}