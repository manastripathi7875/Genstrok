import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminReview() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("project_submissions")
      .select("*, projects(title, reward_rupees)")
      .eq("status", "submitted")
      .then(({ data }) => setRows(data || []));
  }, []);

  async function approve(r:any) {
    await supabase
      .from("project_submissions")
      .update({ status: "approved" })
      .eq("id", r.id);

    await supabase.rpc("add_wallet_balance", {
      uid: r.user_id,
      amount: r.projects.reward_rupees
    });

    location.reload();
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-xl mb-4">Admin Review</h1>

      {rows.map(r => (
        <div key={r.id} className="border border-slate-800 rounded-xl p-3 mb-3">
          <p className="font-semibold">{r.projects.title}</p>
          <p className="text-sm text-slate-400">{r.proof_text}</p>

          <button
            onClick={() => approve(r)}
            className="mt-2 bg-emerald-500 text-black px-4 py-1 rounded-full"
          >
            Approve & Pay
          </button>
        </div>
      ))}
    </div>
  );
}