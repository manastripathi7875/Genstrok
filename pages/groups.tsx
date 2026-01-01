// pages/groups.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function GroupsPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });

    supabase
      .from("communities")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => setCommunities(data || []));
  }, []);

  useEffect(() => {
    if (!activeCommunity) return;

    supabase
      .from("groups")
      .select("*")
      .eq("community_id", activeCommunity)
      .eq("is_public", true)
      .then(({ data }) => setGroups(data || []));
  }, [activeCommunity]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 pb-24">
      <h1 className="pt-6 text-sm font-semibold">👥 Communities</h1>

      {/* COMMUNITIES */}
      <div className="mt-4 flex gap-3 overflow-x-auto">
        {communities.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCommunity(c.id)}
            className={`rounded-full px-4 py-1.5 text-xs ${
              activeCommunity === c.id
                ? "bg-violet-500 text-black"
                : "bg-slate-800"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* GROUPS */}
      <div className="mt-6 space-y-4">
        {groups.map((g) => (
          <div
            key={g.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5"
          >
            <p className="font-semibold text-sm">{g.name}</p>
            <p className="mt-1 text-xs text-slate-400">
              {g.description}
            </p>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-emerald-400">
                {g.join_type === "paid"
                  ? `Paid · ${g.join_coins} coins`
                  : "Free to join"}
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
    </div>
  );
}