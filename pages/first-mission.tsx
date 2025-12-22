// pages/first-mission.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type Mission = {
  id: number;
  title: string;
  reward_coins: number;
};

export default function FirstMissionPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [pending, setPending] = useState<Mission[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/landing");
      return;
    }

    setUserId(user.id);

    const today = new Date().toISOString().slice(0, 10);

    // 1️⃣ fetch all daily missions
    const { data: allMissions, error: mErr } = await supabase
      .from("missions")
      .select("id,title,reward_coins")
      .eq("is_daily", true)
      .order("id");

    if (mErr || !allMissions) {
      setPending([]);
      setLoading(false);
      return;
    }

    // 2️⃣ fetch completed logs
    const { data: logs } = await supabase
      .from("mission_logs")
      .select("mission_id")
      .eq("user_id", user.id)
      .eq("completed_on", today);

    const completedIds = logs?.map((l) => l.mission_id) || [];

    // 3️⃣ split pending vs completed
    setCompleted(completedIds);
    setPending(allMissions.filter((m) => !completedIds.includes(m.id)));

    setLoading(false);
  }

  async function completeMission(mission: Mission) {
    if (!userId) return;

    setProcessingId(mission.id);

    const today = new Date().toISOString().slice(0, 10);

    // 🪙 add coins
    await supabase.rpc("increment_user_coins", {
      uid: userId,
      amount: mission.reward_coins,
    });

    // 📝 log completion
    await supabase.from("mission_logs").insert({
      user_id: userId,
      mission_id: mission.id,
      completed_on: today,
    });

    const newCompleted = [...completed, mission.id];
    const newPending = pending.filter((m) => m.id !== mission.id);

    setCompleted(newCompleted);
    setPending(newPending);
    setProcessingId(null);

    // 🎯 all missions done → unlock app
    if (newPending.length === 0) {
      await supabase.from("user_flags").upsert({
        user_id: userId,
        first_mission_done: true,
      });

      setTimeout(() => {
        router.replace("/");
      }, 1000);
    }
  }

  // 🔄 LOADING STATE
  if (loading) {
    return (
      <div style={styles.center}>
        <p>Loading today’s missions…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>🎯 Today’s Missions</h1>
      <p style={styles.subtitle}>
        Complete these to unlock Genstrok
      </p>

      {/* PENDING MISSIONS */}
      {pending.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Pending</h3>

          {pending.map((m) => (
            <div key={m.id} style={styles.card}>
              <div>
                <div style={styles.missionTitle}>{m.title}</div>
                <div style={styles.reward}>
                  +{m.reward_coins} coins
                </div>
              </div>

              <button
                onClick={() => completeMission(m)}
                disabled={processingId === m.id}
                style={{
                  ...styles.button,
                  opacity: processingId === m.id ? 0.6 : 1,
                }}
              >
                {processingId === m.id
                  ? "Completing…"
                  : "Complete"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* COMPLETED MISSIONS */}
      {completed.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Completed</h3>

          {completed.map((id) => (
            <div key={id} style={{ ...styles.card, opacity: 0.6 }}>
              <div>Mission completed</div>
              <span>✔</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    padding: "32px 20px",
    background:
      "radial-gradient(circle at top, #1a1a2e, #000)",
    color: "#fff",
  },
  center: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#aaa",
  },
  title: {
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 12,
  },
  card: {
    background: "#111",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  missionTitle: {
    fontWeight: 600,
    marginBottom: 4,
  },
  reward: {
    fontSize: 12,
    opacity: 0.7,
  },
  button: {
    padding: "8px 18px",
    borderRadius: 999,
    border: "none",
    background: "#7f5cff",
    color: "#fff",
    cursor: "pointer",
  },
};