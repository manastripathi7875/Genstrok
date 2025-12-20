// components/admin/DeleteRequestsClient.tsx
"use client";

import { useEffect, useState } from "react";

type ReqRow = {
  id: string;
  user_id: string;
  reason?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function fmtShort(dt?: string | null) {
  if (!dt) return "-";
  try {
    return new Date(dt).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return dt;
  }
}

export default function DeleteRequestsClient() {
  const [adminKey, setAdminKey] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("admin_key") : null
  );
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ReqRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (adminKey) fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/delete-requests`;
      const res = await fetch(url, {
        headers: { "x-admin-key": adminKey || "" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || res.statusText);
      }
      const json = await res.json();
      setRequests(json.requests || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function saveKey(k: string) {
    sessionStorage.setItem("admin_key", k);
    setAdminKey(k);
  }

  function clearKey() {
    sessionStorage.removeItem("admin_key");
    setAdminKey(null);
    setRequests([]);
  }

  async function changeStatus(id: string, status: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/delete-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey || "",
        },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || res.statusText);
      }
      await fetchList();
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    }
  }

  async function triggerProcess() {
    if (!confirm("Run delete processor now? This will attempt to delete pending accounts (staging only).")) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/process-delete-requests`, {
        method: "POST",
        headers: { "x-admin-key": adminKey || "" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || res.statusText);
      }
      const json = await res.json();
      alert("Processed: " + (json.processed ?? 0));
      await fetchList();
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setProcessing(false);
    }
  }

  async function processSingle(id: string) {
    if (!confirm("Delete this user now? Permanent.")) return;
    try {
      const res = await fetch(`/api/admin/delete-request-action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey || "",
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || res.statusText);
      }
      await fetchList();
      alert("Deleted");
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    }
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-3">Admin — Account delete requests</h1>

      {!adminKey ? (
        <div className="mb-4">
          <p className="mb-2 text-sm text-slate-400">
            Enter your admin key to access request list (stored in session only).
          </p>
          <div className="flex gap-2">
            <input
              placeholder="paste admin key"
              className="flex-1 rounded-md border px-3 py-2 bg-slate-900 text-white"
              onChange={(e) => {
                const v = e.target.value.trim();
                (window as any).__tmpKey = v;
              }}
            />
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-white"
              onClick={() => {
                const v = (window as any).__tmpKey || "";
                if (!v) return alert("Provide key first");
                saveKey(v);
              }}
            >
              Unlock
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Make sure ADMIN_API_KEY env matches this key on the server.
          </p>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          <div>
            <button className="rounded-md bg-slate-700 px-3 py-2 text-white mr-2" onClick={fetchList}>
              Refresh
            </button>
            <button className="rounded-md bg-rose-600 px-3 py-2 text-white mr-2" onClick={clearKey}>
              Lock
            </button>
            <button
              className="rounded-md bg-violet-600 px-3 py-2 text-white"
              onClick={triggerProcess}
              disabled={processing}
            >
              {processing ? "Processing…" : "Run processor"}
            </button>
          </div>
          <div className="ml-auto text-sm text-slate-400">
            Session unlocked
          </div>
        </div>
      )}

      {error && <div className="mb-3 rounded-md bg-rose-900/60 p-3 text-sm text-rose-100">{error}</div>}

      <div className="space-y-3">
        {loading ? (
          <div>Loading…</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="rounded-xl border p-3 bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full h-9 w-9 bg-slate-800 flex items-center justify-center text-xs">
                        {r.user_id.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{r.user_id}</div>
                        <div className="text-xs text-slate-400">
                          {r.reason || "No reason provided"}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">
                      {fmtShort(r.created_at)}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-[13px] rounded px-2 py-1 bg-slate-800/60">{r.status}</div>

                    <div className="ml-auto flex gap-2">
                      <button
                        className="rounded px-2 py-1 bg-sky-700 text-white text-xs"
                        onClick={() => changeStatus(r.id, "processing")}
                      >
                        Processing
                      </button>
                      <button
                        className="rounded px-2 py-1 bg-emerald-600 text-white text-xs"
                        onClick={() => changeStatus(r.id, "completed")}
                      >
                        Completed
                      </button>
                      <button
                        className="rounded px-2 py-1 bg-rose-600 text-white text-xs"
                        onClick={() => changeStatus(r.id, "rejected")}
                      >
                        Reject
                      </button>
                      <button
                        className="rounded px-2 py-1 bg-black/80 border border-rose-600 text-rose-400 text-xs"
                        onClick={() => processSingle(r.id)}
                      >
                        Delete now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}