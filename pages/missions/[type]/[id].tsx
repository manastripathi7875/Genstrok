import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function TaskDetailPage() {
  const router = useRouter();
  const { type, id } = router.query;

  const [user, setUser] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [proofText, setProofText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) return;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push("/auth");
        return;
      }
      setUser(auth.user);

      const table =
        type === "mission" ? "daily_missions" : "brand_tasks";

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .single();

      if (!error) setTask(data);
      setLoading(false);
    }

    load();
  }, [type, id]);

  async function submitProof() {
    if (!proofText.trim()) {
      setMsg("Proof likhna zaroori hai");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("task_proofs").insert({
      user_id: user.id,
      task_type: type,
      task_id: Number(id),
      proof_text: proofText,
      status: "submitted",
    });

    if (error) {
      setMsg("Error: proof submit nahi hua");
    } else {
      setMsg("Proof submitted. Approval pending.");
      setProofText("");
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        Loading…
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        Task not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white p-5">
      <button
        onClick={() => router.back()}
        className="text-sm text-slate-400 mb-4"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold">{task.title}</h1>

      <p className="mt-2 text-slate-400 text-sm">
        {task.short_description}
      </p>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm font-semibold mb-2">
          How to complete
        </p>
        <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
          <li>Instructions follow karo</li>
          <li>Task complete karo honestly</li>
          <li>Proof niche paste karo</li>
        </ul>
      </div>

      <div className="mt-5">
        <label className="text-sm text-slate-300">
          Proof (link / text)
        </label>

        <textarea
          value={proofText}
          onChange={(e) => setProofText(e.target.value)}
          className="mt-2 w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm"
          rows={4}
          placeholder="Example: https://instagram.com/..."
        />
      </div>

      {msg && (
        <p className="mt-3 text-sm text-emerald-400">
          {msg}
        </p>
      )}

      <button
        onClick={submitProof}
        disabled={submitting}
        className="mt-4 rounded-full bg-violet-500 px-6 py-2 text-sm font-semibold text-black disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit Proof"}
      </button>
    </div>
  );
}