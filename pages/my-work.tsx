import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type ProofRow = {
  id: number;
  task_type: string;
  task_id: number;
  proof_text: string;
  status: string;
  created_at: string;
};

export default function MyWorkPage() {
  const [rows, setRows] = useState<ProofRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data, error } = await supabase
        .from("task_proofs")
        .select("*")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (!error) setRows(data || []);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-6 pb-20">
      <h1 className="text-xl font-bold mb-4">My Work</h1>

      {loading && (
        <p className="text-sm text-slate-400">Loading your work…</p>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-400">
          You haven’t submitted any task yet.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="bg-slate-950 border border-slate-800 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {r.task_type === "mission"
                  ? "Daily Mission"
                  : "Brand Task"}
              </p>

              <span
                className={
                  "text-xs px-3 py-1 rounded-full " +
                  (r.status === "approved"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : r.status === "rejected"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-yellow-500/20 text-yellow-400")
                }
              >
                {r.status.toUpperCase()}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Proof:
            </p>

            <p className="text-sm text-slate-300 mt-1">
              {r.proof_text}
            </p>

            <p className="mt-2 text-[10px] text-slate-500">
              Submitted on{" "}
              {new Date(r.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}