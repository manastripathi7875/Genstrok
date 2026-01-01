import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function GroupDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);

  const [isMember, setIsMember] = useState(false);
  const [role, setRole] = useState<"leader" | "admin" | "member" | null>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");

  const [missions, setMissions] = useState<any[]>([]);
  const [completedMap, setCompletedMap] = useState<Record<number, boolean>>({});

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  /* ---------------- LOAD GROUP ---------------- */
  useEffect(() => {
    if (!id || !user) return;

    async function load() {
      // group
      const { data: g } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();
      setGroup(g);

      // membership + role
      const { data: m } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (m) {
        setIsMember(true);
        setRole(m.role);
      } else {
        setIsMember(false);
        setRole(null);
      }

      // posts
      const { data: p } = await supabase
        .from("group_posts")
        .select("*")
        .eq("group_id", id)
        .order("created_at", { ascending: false });

      setPosts(p || []);

      // group missions
      const { data: gm } = await supabase
        .from("group_missions")
        .select("*")
        .eq("group_id", id)
        .order("created_at", { ascending: false });

      setMissions(gm || []);

      // completed missions
      const { data: done } = await supabase
        .from("group_mission_completions")
        .select("mission_id")
        .eq("user_id", user.id);

      const map: Record<number, boolean> = {};
      (done || []).forEach((r: any) => (map[r.mission_id] = true));
      setCompletedMap(map);
    }

    load();
  }, [id, user]);

  /* ---------------- JOIN GROUP ---------------- */
  async function joinGroup() {
    if (!user) return router.push("/auth");

    if (group.join_type === "paid") {
      await supabase.rpc("deduct_coins", {
        uid: user.id,
        amount: group.join_coins,
      });
    }

    await supabase.from("group_members").insert({
      group_id: id,
      user_id: user.id,
      role: "member",
    });

    setIsMember(true);
    setRole("member");
  }

  if (!group) return null;

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 pb-24">
      <button onClick={() => router.back()} className="pt-4 text-xs">
        ← Back
      </button>

      {/* GROUP INFO */}
      <section className="mt-4 rounded-3xl border border-slate-800 p-6">
        <h1 className="text-lg font-semibold">{group.name}</h1>
        <p className="mt-2 text-sm text-slate-400">{group.description}</p>

        {!isMember ? (
          <button
            onClick={joinGroup}
            className="mt-6 w-full rounded-full bg-violet-500 py-2 text-sm font-semibold text-black"
          >
            {group.join_type === "paid"
              ? `Join for ${group.join_coins} coins`
              : "Join group"}
          </button>
        ) : (
          <button
            onClick={() => router.push(`/chat/group-${group.id}`)}
            className="mt-6 w-full rounded-full bg-emerald-500 py-2 text-sm font-semibold text-black"
          >
            Open Group Chat
          </button>
        )}
      </section>

      {/* CREATE POST */}
      {isMember && (
        <section className="mt-6 rounded-2xl border border-slate-800 p-4">
          <p className="text-sm font-semibold mb-2">✍️ Share with group</p>

          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm"
            rows={3}
          />

          <button
            disabled={!newPost}
            onClick={async () => {
              const { data } = await supabase
                .from("group_posts")
                .insert({
                  group_id: id,
                  user_id: user.id,
                  content: newPost,
                })
                .select()
                .single();

              setPosts((prev) => [data, ...prev]);
              setNewPost("");
            }}
            className="mt-3 rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-black"
          >
            Post
          </button>
        </section>
      )}

      {/* GROUP FEED */}
      <section className="mt-6 space-y-4">
        <p className="text-sm font-semibold">📰 Group Feed</p>

        {posts.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-slate-800 bg-slate-950 p-4"
          >
            <p className="text-sm">{p.content}</p>
            <p className="mt-2 text-xs text-slate-400">
              {new Date(p.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </section>

      {/* GROUP MISSIONS */}
      <section className="mt-6 space-y-3">
        <p className="text-sm font-semibold">🎯 Group Tasks</p>

        {missions.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-slate-800 p-4"
          >
            <p className="text-sm font-semibold">{m.title}</p>
            <p className="text-xs text-emerald-400">
              +{m.reward_coins} coins
            </p>

            <button
              disabled={completedMap[m.id]}
              onClick={async () => {
                await supabase.from("group_mission_completions").insert({
                  mission_id: m.id,
                  user_id: user.id,
                });

                setCompletedMap((p) => ({ ...p, [m.id]: true }));
              }}
              className="mt-3 rounded-full bg-emerald-500 px-4 py-1.5 text-sm text-black disabled:opacity-50"
            >
              {completedMap[m.id] ? "Completed" : "Complete"}
            </button>
          </div>
        ))}
      </section>

      {/* LEADER ADMIN */}
      {isMember && role === "leader" && (
        <section className="mt-6 rounded-2xl border border-slate-800 p-4">
          <p className="text-sm font-semibold mb-2">👑 Group Admin</p>

          <button
            onClick={async () => {
              const title = prompt("Mission title?");
              const coins = prompt("Coins reward?");
              if (!title || !coins) return;

              const { data } = await supabase
                .from("group_missions")
                .insert({
                  group_id: id,
                  title,
                  reward_coins: Number(coins),
                  created_by: user.id,
                })
                .select()
                .single();

              setMissions((p) => [data, ...p]);
            }}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm text-black"
          >
            + Create Group Task
          </button>
        </section>
      )}
    </div>
  );
}