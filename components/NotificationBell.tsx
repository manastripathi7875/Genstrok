import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type NotificationRow = {
  id: string;
  created_at: string;
  for_buyer: string | null;
  type: string;
  title: string;
  body: string | null;
  meta: any;
};

      export default function NotificationBell({
        userEmail,
        userId,
      }: {
        userEmail?: string | null;
        userId?: string | null;
      }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("buyer_id", userId || "")   // sirf apni id    
      .or(
    userId && userEmail
      ? `buyer_id.eq.${userId},for_buyer.eq.${userEmail},for_buyer.is.null`
      : userId
      ? `buyer_id.eq.${userId},for_buyer.is.null`
      : userEmail
      ? `for_buyer.eq.${userEmail},for_buyer.is.null`
      : `for_buyer.is.null`
  )
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("notif load error", error);
      } else if (mounted) {
        setRows((data || []) as NotificationRow[]);
        setUnread((data || []).length);
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          if (!n.for_buyer || (userEmail && n.for_buyer === userEmail)) {
            setRows((prev) => [n, ...prev].slice(0, 30));
            setUnread((u) => u + 1);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userEmail]);

  function toggleOpen() {
    if (!open) {
      setUnread(0);
    }
    setOpen((s) => !s);
  }

  return (
    <>
      {/* Bell button */}
      <button
        onClick={toggleOpen}
        title="Notifications"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/70 bg-slate-950/80 text-[14px] text-slate-100"
      >
        🔔
        {unread > 0 && (
          <span className="ml-1 -mr-5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>

      {/* Overlay panel (full-screen click area, card top-right) */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 p-3 pt-12"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-950/95 p-3 shadow-2xl backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">
                Notifications
              </div>
              <button
                onClick={() => {
                  setRows([]);
                  setUnread(0);
                  setOpen(false);
                }}
                className="text-[11px] text-slate-400"
              >
                Clear
              </button>
            </div>

            <div className="max-h-72 space-y-1 overflow-auto">
              {loading ? (
                <div className="animate-pulse text-[12px] text-slate-500">
                  Loading…
                </div>
              ) : rows.length === 0 ? (
                <div className="text-[12px] text-slate-500">
                  No notifications yet.
                </div>
              ) : (
                rows.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-slate-800/70 px-3 py-2 hover:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-slate-100">
                          {r.title}
                        </div>
                        {r.body && (
                          <div className="mt-1 text-[12px] text-slate-400">
                            {r.body}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-[10px] text-slate-500">
                        {new Date(r.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-2 text-right">
              <a
                href="/notifications"
                className="text-xs text-sky-300 underline"
              >
                View all →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}