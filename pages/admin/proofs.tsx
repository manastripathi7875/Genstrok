import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { insertLedgerEntry } from "../../lib/ledger";

type ProofRow = {
  id: string;
  user_id: string;
  task_type: "mission" | "brand";
  task_id: number;
  proof_text: string | null;
  proof_value?: string | null;
  status: "submitted" | "approved" | "rejected";
  created_at: string;
};

export default function AdminProofs() {
  const [rows, setRows] = useState<ProofRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("task_proofs")
      .select("*")
      .eq("status", "submitted")
      .order("created_at", { ascending: true });

    if (!error) setRows((data || []) as ProofRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(p: ProofRow) {
    if (actionId) return;
    setActionId(p.id);

    try {
      // 1️⃣ mark approved
      await supabase
        .from("task_proofs")
        .update({ status: "approved" })
        .eq("id", p.id);

      // 2️⃣ fetch reward config
      const table =
        p.task_type === "mission" ? "daily_missions" : "brand_tasks";

      const { data: task, error: taskErr } = await supabase
        .from(table)
        .select("reward_rupees,reward_coins")
        .eq("id", p.task_id)
        .single();

      if (taskErr || !task) {
        console.error("Task fetch error", taskErr);
        return;
      }

      const coins = Number(task.reward_coins || 0);
      const rupees = Number(task.reward_rupees || 0);

      // 3️⃣ ledger entry
      if (coins > 0) {
        await insertLedgerEntry({
          user_id: p.user_id,
          source_type: p.task_type,
          source_id: String(p.task_id),
          points: coins,
          weight: p.task_type === "brand" ? 2 : 1,
        });
      }

      // 4️⃣ wallet payout
      if (rupees > 0) {
        await supabase.rpc("add_wallet_balance", {
          uid: p.user_id,
          amount: rupees,
        });
      }

      // 5️⃣ refresh list
      load();
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string) {
    if (actionId) return;
    setActionId(id);

    await supabase
      .from("task_proofs")
      .update({ status: "rejected" })
      .eq("id", id);

    load();
    setActionId(null);
  }

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 p-4">
      <h1 className="text-xl font-bold mb-4">
        Admin · Proof Review
      </h1>

      {loading ? (
        <p className="text-sm text-slate-400">Loading proofs…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">
          No pending proofs 🎉
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-slate-400">
                    {p.task_type.toUpperCase()} #{p.task_id}
                  </p>
                  <p className="text-sm mt-1">
                    {p.proof_text || p.proof_value || "No proof text"}
                  </p>
                </div>

                <p className="text-[10px] text-slate-500">
                  {new Date(p.created_at).toLocaleString()}
                </p>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => approve(p)}
                  disabled={actionId === p.id}
                  className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Approve & Pay
                </button>

                <button
                  onClick={() => reject(p.id)}
                  disabled={actionId === p.id}
                  className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}