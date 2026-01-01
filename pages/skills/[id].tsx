// pages/skills/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { BRAND } from "../../lib/brand";

type Skill = {
  id: number;
  title: string;
  short_description: string | null;
  cover_url: string | null;
  difficulty: string | null;
  unlock_cost_coins: number;
};

type LinkedTask = {
  task_type: "mission" | "brand";
  task_id: number;
  title: string;
  reward_coins: number;
  reward_rupees: number;
};

export default function SkillDetailPage() {
  const router = useRouter();
  const rawId = router.query.id;

  const skillId = useMemo(() => {
    const n = Number(rawId);
    return Number.isNaN(n) ? null : n;
  }, [rawId]);

  const [user, setUser] = useState<any>(null);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [tasks, setTasks] = useState<LinkedTask[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= AUTH ================= */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    if (!skillId || !user) return;

    async function load() {
      setLoading(true);

      // 1️⃣ skill
      const { data: s } = await supabase
        .from("skills")
        .select("*")
        .eq("id", skillId)
        .maybeSingle();

      if (!s) {
        setSkill(null);
        setLoading(false);
        return;
      }

      setSkill(s as Skill);

      // 2️⃣ unlocked?
      const { data: us } = await supabase
        .from("user_skills")
        .select("skill_id")
        .eq("user_id", user.id)
        .eq("skill_id", skillId)
        .maybeSingle();

      setIsUnlocked(!!us);

      // 3️⃣ linked tasks
      const { data: maps } = await supabase
        .from("skill_tasks_map")
        .select("task_type, task_id")
        .eq("skill_id", skillId);

      if (!maps || maps.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // split ids
      const missionIds = maps
        .filter((m: any) => m.task_type === "mission")
        .map((m: any) => m.task_id);

      const brandIds = maps
        .filter((m: any) => m.task_type === "brand")
        .map((m: any) => m.task_id);

      const linked: LinkedTask[] = [];

      if (missionIds.length) {
        const { data: m } = await supabase
          .from("daily_missions")
          .select("id,title,reward_coins,reward_rupees")
          .in("id", missionIds);

        (m || []).forEach((r: any) =>
          linked.push({
            task_type: "mission",
            task_id: r.id,
            title: r.title,
            reward_coins: r.reward_coins || 0,
            reward_rupees: r.reward_rupees || 0,
          })
        );
      }

      if (brandIds.length) {
        const { data: b } = await supabase
          .from("brand_tasks")
          .select("id,title,reward_coins,reward_rupees")
          .in("id", brandIds);

        (b || []).forEach((r: any) =>
          linked.push({
            task_type: "brand",
            task_id: r.id,
            title: r.title,
            reward_coins: r.reward_coins || 0,
            reward_rupees: r.reward_rupees || 0,
          })
        );
      }

      setTasks(linked);
      setLoading(false);
    }

    load();
  }, [skillId, user]);

  if (!skillId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Invalid skill</p>
      </div>
    );
  }

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20">
      <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <button
          onClick={() => router.back()}
          className="text-xs text-slate-300"
        >
          ← Back
        </button>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4">
        {loading ? (
          <p className="text-xs text-slate-400">Loading skill…</p>
        ) : !skill ? (
          <p className="text-xs text-slate-400">Skill not found</p>
        ) : (
          <>
            {/* SKILL CARD */}
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
              <div className="flex gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-800 overflow-hidden flex items-center justify-center text-xl">
                  {skill.cover_url ? (
                    <img
                      src={skill.cover_url}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "📘"
                  )}
                </div>

                <div className="flex-1">
                  <h1 className="text-lg font-semibold">
                    {skill.title}
                  </h1>
                  <p className="mt-1 text-xs text-slate-400">
                    {skill.short_description ||
                      "Skill to improve earning potential"}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Difficulty: {skill.difficulty || "beginner"}
                  </p>
                </div>
              </div>

              {!isUnlocked && (
                <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300">
                  🔒 Unlock this skill to access earning tasks
                </div>
              )}
            </div>

            {/* TASKS */}
            <section className="mt-6">
              <h2 className="text-sm font-semibold mb-3">
                Tasks unlocked by this skill
              </h2>

              {tasks.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No tasks linked yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((t, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
                    >
                      <p className="text-sm font-semibold">
                        {t.title}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        +{t.reward_coins} coins
                        {t.reward_rupees > 0
                          ? ` • ₹${t.reward_rupees}`
                          : ""}
                      </p>

                      <button
                        disabled={!isUnlocked}
                        onClick={() =>
                          router.push(
                            t.task_type === "mission"
                              ? `/missions/mission/${t.task_id}`
                              : `/missions/brand/${t.task_id}`
                          )
                        }
                        className={`mt-3 rounded-full px-4 py-1.5 text-[11px] font-semibold ${
                          isUnlocked
                            ? "bg-violet-500 text-slate-950"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isUnlocked
                          ? "Go to task →"
                          : "Locked"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="mt-8 text-[10px] text-slate-500 text-center">
              Skills on {BRAND.name} unlock better earning paths.
            </p>
          </>
        )}
      </main>
    </div>
  );
}