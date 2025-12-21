import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function TopPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      const { data, error } = await supabase
        .from("leaderboard_global")
        .select("*");

      if (!error && data) {
        setLeaderboard(data);
      }

      
      setLoading(false);
    }

    loadLeaderboard();
  }, []);

  if (loading) return <div>Loading leaderboard...</div>;

  return (
    <div>
      <h1>Top Users</h1>
      {leaderboard.map((u, i) => (
        <div key={u.user_id}>
          #{i + 1} {u.email} — {u.score}
        </div>
      ))}
    </div>
  );
}