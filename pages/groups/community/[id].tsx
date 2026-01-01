import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function CommunityGroupsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("groups")
        .select("*")
        .eq("community_id", id)
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      setGroups(data || []);
      setLoading(false);
    }
    load();
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 pb-28">
      <button
        onClick={() => router.back()}
        className="pt-4 text-xs text-slate-400"
      >
        ← Back
      </button>

      <h1 className="mt-4 text-lg font-semibold">👥 Groups</h1>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="mt-6 space-y-4">
          {groups.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5"
            >
              <p className="text-sm font-semibold">{g.name}</p>
              <p className="mt-1 text-xs text-slate-400">{g.description}</p>

              <div className="mt-3 flex justify-between items-center">
                <span className="text-[11px] text-emerald-400">
                  {g.join_type === "paid"
                    ? `Paid · ${g.join_coins} coins`
                    : "Free"}
                </span>

                <button
                  onClick={() => router.push(`/groups/${g.id}`)}
                  className="rounded-full bg-violet-500 px-4 py-1.5 text-[11px] font-semibold text-black"
                >
                  View →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}