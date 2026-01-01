import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";
import Link from "next/link";

export default function NotificationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: authData, error } = await supabase.auth.getUser();

      if (error || !authData?.user) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      const user = authData.user;

      const { data, error: notifError } = await supabase
        .from("notifications")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (notifError) {
        console.error("Notification load error:", notifError);
        setRows([]);
      } else {
        setRows(data || []);
      }

      setLoading(false);
    }

    load();
  }, []);
  useEffect(() => {
  const channel = supabase
    .channel("realtime-notifications")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
      },
      (payload) => {
        setRows((prev) => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  /* 🔐 LOGIN REQUIRED */
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please log in to view notifications.
          </p>

          <Link
            href="/auth"
            className="mt-4 inline-flex rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-slate-950"
          >
            Go to Login →
          </Link>
        </div>
      </div>
    );
  }

  /* 🔔 MAIN UI */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto max-w-3xl p-6">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs"
          >
            ← Back
          </Link>

          <div className="text-right">
            <p className="text-[11px] text-slate-400">
              Activity on {BRAND.name}
            </p>
            <h1 className="text-sm font-semibold">Notifications</h1>
          </div>
        </header>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-400">
              No notifications yet.
            </p>
          ) : (
            rows.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (n.link) window.location.href = n.link;
                }}
                className="w-full text-left rounded-xl border border-slate-800 bg-slate-950/80 p-4 hover:bg-slate-900/70 transition"
              >
                <p className="text-sm font-semibold">
                  {n.title}
                </p>
                <p className="text-xs text-slate-400">
                  {n.body}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}