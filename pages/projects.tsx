import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      setProjects(data || []);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">
          Live Projects
        </h1>

        <div className="space-y-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-5"
            >
              <h2 className="font-semibold">{p.title}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {p.description}
              </p>

              <div className="mt-3 flex justify-between items-center">
                <span className="text-emerald-400">
                  ₹{p.reward_rupees}
                </span>

                <button
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="text-sm bg-violet-500 text-black px-4 py-1 rounded-full"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}