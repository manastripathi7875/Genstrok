import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<any>(null);
  const [proof, setProof] = useState("");

  useEffect(() => {
    if (!id) return;
    supabase.from("projects").select("*").eq("id", id).single()
      .then(({ data }) => setProject(data));
  }, [id]);

  async function submit() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    await supabase.from("project_submissions").insert({
      project_id: id,
      user_id: auth.user.id,
      proof_text: proof
    });

    alert("Submitted");
    router.push("/my-work");
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-[#050816] text-white p-4">
      <h1 className="text-xl font-bold">{project.title}</h1>
      <p className="text-slate-400 mt-2">{project.description}</p>

      <textarea
        className="w-full mt-4 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm"
        placeholder="Explain what you did"
        value={proof}
        onChange={e => setProof(e.target.value)}
      />

      <button
        onClick={submit}
        className="mt-4 bg-emerald-500 text-black px-6 py-2 rounded-full"
      >
        Submit Work
      </button>
    </div>
  );
}