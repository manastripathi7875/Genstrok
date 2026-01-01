// pages/skills.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";
import { insertLedgerEntry } from "../lib/ledger";

type Skill = {
  id: number;
  title: string;
  short_description: string | null;
  cover_url: string | null;
  difficulty: string | null;
  unlock_cost_coins: number;
};

export default function SkillFeedPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [unlocked, setUnlocked] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);

  /* ================= AUTH ================= */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  /* ================= LOAD SKILLS ================= */
  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);

      // all skills
      const { data: s } = await supabase
        .from("skills")
        .select("*")
        .order("created_at", { ascending: false });

      setSkills((s || []) as Skill[]);

      // unlocked skills
      const { data: us } = await supabase
        .from("user_skills")
        .select("skill_id")
        .eq("user_id", user.id);

      setUnlocked((us || []).map((r: any) => r.skill_id));
      setLoading(false);
    }

    load();
  }, [user]);

  /* ================= UNLOCK ================= */
  async function unlockSkill(skill: Skill) {
    if (!user || unlockingId) return;

    setUnlockingId(skill.id);

    try {
      // 1️⃣ deduct coins (ledger)
      if (skill.unlock_cost_coins > 0) {
        await insertLedgerEntry({
          user_id: user.id,
          source_type: "skill_unlock",
          source_id: String(skill.id),
          points: -skill.unlock_cost_coins,
          weight: 1,
        });
      }

      // 2️⃣ mark unlocked
      await supabase.from("user_skills").insert({
        user_id: user.id,
        skill_id: skill.id,
      });
await supabase.from("activity_feed").insert({
  actor_id: user.id,
  actor_name: user.email,
  action_type: "skill_unlocked",
  target_type: "skill",
  target_id: String(skill.id),
});
      // 3️⃣ notification
      await supabase.from("notifications").insert({
        buyer_id: user.id,
        title: "Skill unlocked 🎓",
        body: `You unlocked ${skill.title}`,
      });

      // 4️⃣ activity feed
      await supabase.from("activity_feed").insert({
        actor_id: user.id,
        actor_name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email,
        action_type: "skill_unlocked",
        target_type: "skill",
        target_id: String(skill.id),
        meta: { title: skill.title },
      });

      setUnlocked((prev) => [...prev, skill.id]);
    } finally {
      setUnlockingId(null);
    }
  }

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20">
      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <h1 className="text-sm font-semibold">🎓 Skill Feed</h1>
        <p className="text-[11px] text-slate-400">
          Learn skills to unlock better earning on {BRAND.name}
        </p>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {loading ? (
          <p className="text-xs text-slate-400">Loading skills…</p>
        ) : skills.length === 0 ? (
          <p className="text-xs text-slate-400">
            No skills added yet.
          </p>
        ) : (
          skills.map((skill) => {
            const isUnlocked = unlocked.includes(skill.id);

            return (
              <div
                key={skill.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
              >
                <div className="flex gap-3">
                  <div className="h-12 w-12 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center text-sm">
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
                    <p className="text-sm font-semibold">
                      {skill.title}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {skill.short_description ||
                        "Skill to improve earning"}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Difficulty: {skill.difficulty || "beginner"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  {isUnlocked ? (
                    <button
                      onClick={() =>
                        router.push(`/skills/${skill.id}`)
                      }
                      className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-[11px] font-semibold text-emerald-300"
                    >
                      View skill →
                    </button>
                  ) : (
                    <button
                      disabled={unlockingId === skill.id}
                      onClick={() => unlockSkill(skill)}
                      className="rounded-full bg-violet-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 disabled:opacity-60"
                    >
                      {unlockingId === skill.id
                        ? "Unlocking…"
                        : `Unlock · ${skill.unlock_cost_coins} coins`}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}