import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

export default function NotificationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      // User nahi hai ya session missing hai → login screen
      if (authError || !authData?.user) {
        setNeedsLogin(true);
        setRows([]);
        setLoading(false);
        return;
      }

      const user = authData.user;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Notification load error:", error);
        setRows([]);
      } else {
        setRows(data || []);
      }

      setLoading(false);
    }

    load();
  }, []);

  // 🔐 Login required view (yahan bhi Back home button add kiya)
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200"
          >
            <span className="text-lg">←</span>
            <span>Back home</span>
          </a>
        </div>

        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Login required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please log in to view your notifications.
          </p>

          <a
            href="/auth"
            className="mt-4 inline-flex rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400"
          >
            Go to Login →
          </a>
        </div>
      </div>
    );
  }

  // 🧾 Main notifications UI (yahan top-left back icon aa gaya)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto max-w-4xl p-6">
        {/* TOP BAR with BACK ICON */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200"
          >
            <span className="text-lg leading-none">←</span>
            <span>Back</span>
          </a>

          <div className="text-right">
            <p className="text-[11px] text-slate-400">
              Activity on {BRAND.name}
            </p>
            <h1 className="text-sm font-semibold text-slate-100">
              Notifications
            </h1>
          </div>
        </header>

        {/* LIST */}
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-slate-400 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-slate-400 text-sm">
              You have no notifications yet.
            </div>
          ) : (
            rows.map((n: any) => (
              <div
                key={n.id}
                className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 hover:bg-slate-900/70 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {n.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {n.body}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}