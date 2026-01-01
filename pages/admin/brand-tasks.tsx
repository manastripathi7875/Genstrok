import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Skill = {
  id: number;
  title: string;
};

export default function BrandTasksAdmin() {
  /* ================= STATE ================= */
  const [rows, setRows] = useState<any[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [taskType, setTaskType] = useState<"brand" | "mission">("brand");

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [howToComplete, setHowToComplete] = useState("");
  const [brandName, setBrandName] = useState("Genstrok");
  const [brandLogo, setBrandLogo] = useState("");
  const [category, setCategory] = useState("general");

  const [rewardRupees, setRewardRupees] = useState(0);
  const [rewardCoins, setRewardCoins] = useState(0);

  const [requiredSkillId, setRequiredSkillId] = useState<number | null>(null);

  const [proofType, setProofType] = useState<
    "text" | "link" | "image" | "video"
  >("text");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [durationMins, setDurationMins] = useState(10);

  const [creating, setCreating] = useState(false);

  /* ================= LOAD ================= */
  async function load() {
    const table = taskType === "brand" ? "brand_tasks" : "daily_missions";

    const { data } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });

    setRows(data || []);
  }

  async function loadSkills() {
    const { data } = await supabase
      .from("skills")
      .select("id,title")
      .order("title");

    setSkills(data || []);
  }

  useEffect(() => {
    load();
    loadSkills();
  }, [taskType]);

  /* ================= CREATE ================= */
  async function createTask() {
    if (!title || creating) return;

    setCreating(true);

    const basePayload = {
      title,
      short_description: shortDescription,
      how_to_complete: howToComplete,
      reward_rupees: rewardRupees,
      reward_coins: rewardCoins,
      category,
      proof_type: proofType,
      start_date: startDate || null,
      end_date: endDate || null,
      duration_mins: durationMins,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    let taskId: number | null = null;

    if (taskType === "brand") {
      const { data, error } = await supabase
        .from("brand_tasks")
        .insert({
          ...basePayload,
          brand_name: brandName,
          brand_logo: brandLogo || null,
        })
        .select("id")
        .single();

      if (error) {
        alert(error.message);
        setCreating(false);
        return;
      }

      taskId = data.id;
    } else {
      const { data, error } = await supabase
        .from("daily_missions")
        .insert(basePayload)
        .select("id")
        .single();

      if (error) {
        alert(error.message);
        setCreating(false);
        return;
      }

      taskId = data.id;
    }

    /* ===== Skill lock mapping ===== */
    if (requiredSkillId && taskId) {
      await supabase.from("skill_tasks_map").insert({
        task_type: taskType,
        task_id: taskId,
        skill_id: requiredSkillId,
      });
    }

    /* ===== RESET FORM ===== */
    setTitle("");
    setShortDescription("");
    setHowToComplete("");
    setRewardRupees(0);
    setRewardCoins(0);
    setRequiredSkillId(null);
    setStartDate("");
    setEndDate("");
    setDurationMins(10);

    setCreating(false);
    load();
  }

  async function toggle(id: number, active: boolean) {
    const table = taskType === "brand" ? "brand_tasks" : "daily_missions";

    await supabase.from(table).update({ is_active: !active }).eq("id", id);
    load();
  }

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 p-4 md:p-6">
      <h1 className="text-xl font-bold mb-4">
        Admin · Task / Mission Creator
      </h1>

      {/* TASK TYPE */}
      <div className="flex gap-2 mb-4 text-sm">
        <button
          onClick={() => setTaskType("brand")}
          className={`px-4 py-2 rounded-full ${
            taskType === "brand"
              ? "bg-violet-500 text-black"
              : "bg-slate-900"
          }`}
        >
          Brand Task
        </button>
        <button
          onClick={() => setTaskType("mission")}
          className={`px-4 py-2 rounded-full ${
            taskType === "mission"
              ? "bg-violet-500 text-black"
              : "bg-slate-900"
          }`}
        >
          Daily Mission
        </button>
      </div>

      {/* CREATE FORM */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 mb-6 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full bg-black/40 p-2 rounded"
        />

        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          placeholder="Short description"
          className="w-full bg-black/40 p-2 rounded text-sm"
          rows={2}
        />

        <textarea
          value={howToComplete}
          onChange={(e) => setHowToComplete(e.target.value)}
          placeholder="How to complete this task"
          className="w-full bg-black/40 p-2 rounded text-sm"
          rows={3}
        />

        {taskType === "brand" && (
          <>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Brand name"
              className="w-full bg-black/40 p-2 rounded"
            />

            <input
              value={brandLogo}
              onChange={(e) => setBrandLogo(e.target.value)}
              placeholder="Brand logo URL (optional)"
              className="w-full bg-black/40 p-2 rounded text-sm"
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={rewardRupees}
            onChange={(e) => setRewardRupees(Number(e.target.value))}
            placeholder="₹ Reward"
            className="bg-black/40 p-2 rounded"
          />
          <input
            type="number"
            value={rewardCoins}
            onChange={(e) => setRewardCoins(Number(e.target.value))}
            placeholder="Coins reward"
            className="bg-black/40 p-2 rounded"
          />
        </div>

        <select
          value={requiredSkillId ?? ""}
          onChange={(e) =>
            setRequiredSkillId(
              e.target.value ? Number(e.target.value) : null
            )
          }
          className="w-full bg-black/40 p-2 rounded text-sm"
        >
          <option value="">No skill required</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              Requires skill: {s.title}
            </option>
          ))}
        </select>

        <select
          value={proofType}
          onChange={(e) => setProofType(e.target.value as any)}
          className="w-full bg-black/40 p-2 rounded text-sm"
        >
          <option value="text">Text proof</option>
          <option value="link">Link proof</option>
          <option value="image">Image proof</option>
          <option value="video">Video proof</option>
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-black/40 p-2 rounded text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-black/40 p-2 rounded text-sm"
          />
        </div>

        <input
          type="number"
          value={durationMins}
          onChange={(e) => setDurationMins(Number(e.target.value))}
          placeholder="Estimated duration (mins)"
          className="w-full bg-black/40 p-2 rounded"
        />

        <button
          onClick={createTask}
          disabled={creating}
          className="w-full rounded-full bg-emerald-500 py-2 font-semibold text-black disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create Task"}
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {rows.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-slate-800 bg-slate-900 p-3"
          >
            <p className="font-semibold">{t.title}</p>
            <p className="text-xs text-slate-400">
              ₹{t.reward_rupees} · {t.reward_coins} coins
            </p>

            <button
              onClick={() => toggle(t.id, t.is_active)}
              className="mt-2 text-xs underline"
            >
              {t.is_active ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}