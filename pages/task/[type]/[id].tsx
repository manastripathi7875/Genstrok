import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { BRAND } from "../../../lib/brand";

export default function TaskDetailPage() {
  const router = useRouter();
  const { type, id } = router.query;

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !type) return;

    async function load() {
      const table =
        type === "mission" ? "daily_missions" : "brand_tasks";

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error) setTask(data);
      setLoading(false);
    }

    load();
  }, [id, type]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Task not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-6">
      <button
        onClick={() => router.back()}
        className="text-xs text-slate-400 mb-4"
      >
        ← Back
      </button>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs text-slate-400 mb-1">
          {type === "mission" ? "Daily Task" : task.brand_name}
        </p>

        <h1 className="text-xl font-bold">{task.title}</h1>

        <p className="text-sm text-slate-400 mt-2">
          {task.short_description}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-900 rounded-xl p-3">
            <p className="text-xs text-slate-400">Cash Reward</p>
            <p className="text-emerald-400 font-semibold">
              ₹{task.reward_rupees}
            </p>
          </div>

          <div className="bg-slate-900 rounded-xl p-3">
            <p className="text-xs text-slate-400">Coins</p>
            <p className="text-sky-400 font-semibold">
              +{task.reward_coins} {BRAND.coinName}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold mb-1">
            What you need to do
          </p>
          <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
            <li>Read instructions carefully</li>
            <li>Complete the task genuinely</li>
            <li>Submit proof honestly</li>
          </ul>
        </div>

        {task.external_link && (
          <a
            href={task.external_link}
            target="_blank"
            className="block mt-5 text-sm text-violet-400 underline"
          >
            Open external task link
          </a>
        )}

        <button
          onClick={() =>
            router.push(`/task-proof/${type}/${task.id}`)
          }
          className="mt-6 w-full bg-emerald-500 text-black py-2 rounded-xl font-semibold"
        >
          Start Task
        </button>
      </div>
    </div>
  );
}