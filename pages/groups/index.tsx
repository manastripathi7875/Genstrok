import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

export default function CommunitiesPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("communities")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      setCommunities(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 pb-28">
      <h1 className="pt-6 text-lg font-semibold">🌐 Communities</h1>
      <p className="text-xs text-slate-400">
        Join communities, groups & earn together
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4">
          {communities.map((c) => (
            <div
              key={c.id}
              onClick={() => router.push(`/groups/community/${c.id}`)}
              className="cursor-pointer rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-black p-5 hover:border-violet-500 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {c.description}
                  </p>
                </div>

                <span className="text-[11px] text-violet-400">
                  Explore →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}