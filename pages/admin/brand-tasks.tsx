import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function BrandTasksAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState(5);

  async function load() {
    const { data } = await supabase
      .from("brand_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createTask() {
    if (!title) return;

    await supabase.from("brand_tasks").insert({
      brand_name: "Genstrok",
      title,
      reward_rupees: reward,
      reward_coins: reward * 2,
      is_active: true,
    });

    setTitle("");
    setReward(5);
    load();
  }

  async function toggle(id: number, active: boolean) {
    await supabase
      .from("brand_tasks")
      .update({ is_active: !active })
      .eq("id", id);

    load();
  }

  return (
    <div className="min-h-screen bg-black text-white p-5">
      <h1 className="text-xl font-bold mb-4">
        Brand Tasks Admin
      </h1>

      <div className="rounded-xl border border-slate-800 p-4 mb-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full bg-slate-900 p-2 rounded mb-2"
        />

        <input
          type="number"
          value={reward}
          onChange={(e) => setReward(Number(e.target.value))}
          className="w-full bg-slate-900 p-2 rounded mb-2"
        />

        <button
          onClick={createTask}
          className="bg-emerald-500 text-black px-4 py-1.5 rounded-full"
        >
          Create Task
        </button>
      </div>

      {rows.map((t) => (
        <div
          key={t.id}
          className="border border-slate-800 rounded-xl p-3 mb-3"
        >
          <p className="font-semibold">{t.title}</p>
          <p className="text-xs text-slate-400">
            ₹{t.reward_rupees}
          </p>

          <button
            onClick={() => toggle(t.id, t.is_active)}
            className="mt-2 text-sm underline"
          >
            {t.is_active ? "Disable" : "Enable"}
          </button>
        </div>
      ))}
    </div>
  );
}