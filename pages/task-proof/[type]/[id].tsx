import { useRouter } from "next/router";
import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function TaskProofPage() {
  const router = useRouter();
  const { type, id } = router.query;

  const [proof, setProof] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitProof() {
    if (!proof.trim()) return alert("Write proof");

    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    await supabase.from("task_proofs").insert({
      user_id: auth.user.id,
      task_type: type,
      task_id: id,
      proof_text: proof,
      status: "submitted",
    });

    setLoading(false);
    router.push("/missions");
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-6">
      <h1 className="text-xl font-bold">Submit Proof</h1>

      <textarea
        value={proof}
        onChange={(e) => setProof(e.target.value)}
        placeholder="Explain what you did. Link / screenshot info."
        className="mt-4 w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm"
        rows={6}
      />

      <button
        onClick={submitProof}
        disabled={loading}
        className="mt-4 w-full bg-violet-500 text-black py-2 rounded-xl font-semibold"
      >
        {loading ? "Submitting…" : "Submit Proof"}
      </button>
    </div>
  );
}