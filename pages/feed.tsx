// pages/feed.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1️⃣ Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.push("/auth");
        return;
      }
      setUser(data.user);
    });
  }, []);

  // 2️⃣ Load feed
  useEffect(() => {
    if (!user) return;

    async function loadFeed() {
      setLoading(true);

      // following users
      const { data: follows } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const ids = (follows || []).map(f => f.following_id);
      ids.push(user.id); // include self

      // activities
      const { data: feed } = await supabase
        .from("activity_feed")
        .select("*")
        .in("actor_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);

      // brand posts
      const { data: brandPosts } = await supabase
        .from("brand_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      setActivities(feed || []);
      setPosts(brandPosts || []);
      setLoading(false);
    }

    loadFeed();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 p-4">
        Loading feed…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 pb-24">
      <h1 className="text-sm font-semibold mb-4">🌍 Community Feed</h1>

      {/* BRAND POSTS */}
      {posts.map((p) => (
        <div
          key={p.id}
          className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden"
        >
          {p.image_url && (
            <img
              src={p.image_url}
              className="w-full h-48 object-cover"
            />
          )}
          <div className="p-3">
            <p className="text-xs text-slate-400">{p.brand_name}</p>
            <p className="font-semibold">{p.title}</p>
            <p className="text-sm text-slate-300 mt-1">
              {p.description}
            </p>
          </div>
        </div>
      ))}

      {/* ACTIVITY FEED */}
      <div className="space-y-3">
        {activities.map((a) => (
          <div
            key={a.id}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                {a.actor_name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {a.actor_name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {renderText(a)}
                </p>
              </div>
            </div>

            <p className="mt-2 text-[10px] text-slate-500">
              {new Date(a.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderText(a: any) {
  switch (a.action_type) {
    case "follow":
      return "started following someone";
    case "task_completed":
      return "completed a task and earned money";
    case "drop_bought":
      return "bought a drop";
    case "drop_created":
      return "created a new drop";
    case "skill_unlocked":
      return "unlocked a new skill";
    case "group_joined":
      return "joined a group";
    default:
      return "did an activity";
  }
}