// components/admin/AdminClient.tsx
"use client";
import React, { useEffect, useState } from "react";

type ReqRow = {
  id: string;
  user_id: string;
  reason?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function AdminClient() {
  const [adminKey, setAdminKey] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("admin_key") : null
  );
  const [tmpKey, setTmpKey] = useState("");
  const [requests, setRequests] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);

  // toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (adminKey) fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  function saveKey(k: string) {
    sessionStorage.setItem("admin_key", k);
    setAdminKey(k);
    setTmpKey("");
    setToast("Admin unlocked");
  }

  function clearKey() {
    sessionStorage.removeItem("admin_key");
    setAdminKey(null);
    setRequests([]);
    setSelected({});
    setSelectAll(false);
    setToast("Session locked");
  }

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

  async function apiFetch(path: string, opts?: RequestInit) {
    const headers: Record<string, string> = {
      ...(opts?.headers as Record<string, string> | undefined),
    };
    if (adminKey) headers["x-admin-key"] = adminKey;
    const res = await fetch(path, { ...opts, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(body || res.statusText || `HTTP ${res.status}`);
    }
    return res;
  }

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/delete-requests");
      const json = await res.json();
      const list: ReqRow[] = json.requests || [];
      setRequests(list);
      // reset selection
      setSelected({});
      setSelectAll(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(id: string, status: string, reason?: string) {
    setError(null);
    try {
      const res = await apiFetch("/api/admin/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reason }),
      });
      // success
      const json = await res.json().catch(() => ({}));
      if (status === "completed") {
        if (json.deleted) setToast("Account deleted — request marked deleted");
        else setToast("Marked completed (deleted attempt)");
      } else {
        setToast(`Marked ${status}`);
      }
      await fetchList();
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    }
  }

  async function runProcessor() {
    if (!confirm("Run delete processor now? This will attempt to delete pending accounts (staging only).")) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await apiFetch("/api/process-delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      setToast(`Processed: ${json.processed ?? 0}`);
      await fetchList();
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setProcessing(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const copy = { ...s, [id]: !s[id] };
      // update selectAll if all selected
      const allSelected = requests.length > 0 && requests.every((r) => copy[r.id]);
      setSelectAll(allSelected);
      return copy;
    });
  }

  function toggleSelectAll() {
    const will = !selectAll;
    setSelectAll(will);
    const newSel: Record<string, boolean> = {};
    if (will) {
      for (const r of requests) newSel[r.id] = true;
    }
    setSelected(newSel);
  }

  async function bulkComplete() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) {
      setToast("No requests selected");
      return;
    }
    if (!confirm(`Complete (delete) ${ids.length} requests now? This will delete user accounts.`)) return;
    setProcessing(true);
    try {
      for (const id of ids) {
        // sequential to avoid bursts; can be parallel if you want
        await apiFetch("/api/admin/delete-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "completed" }),
        }).catch((e) => {
          console.warn("bulk single fail", id, e);
        });
      }
      setToast(`Bulk processed ${ids.length}`);
      await fetchList();
    } catch (err: any) {
      console.error(err);
      setError(String(err));
    } finally {
      setProcessing(false);
    }
  }

  function exportCSV() {
    if (!requests || requests.length === 0) {
      setToast("No requests to export");
      return;
    }
    const rows = [["id", "user_id", "status", "reason", "created_at", "updated_at"]];
    for (const r of requests) {
      rows.push([r.id, r.user_id, r.status || "", r.reason || "", r.created_at || "", r.updated_at || ""]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delete-requests-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("CSV exported");
  }

  // UI small helpers
  function badgeFor(status?: string) {
    switch (status) {
      case "requested":
        return <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-200 text-xs">Requested</span>;
      case "processing":
        return <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs">Processing</span>;
      case "completed":
        return <span className="px-3 py-1 rounded-full bg-emerald-600 text-emerald-950 text-xs">Completed</span>;
      case "deleted":
        return <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs">Deleted</span>;
      case "rejected":
        return <span className="px-3 py-1 rounded-full bg-slate-600 text-white text-xs">Rejected</span>;
      default:
        return <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-200 text-xs">Unknown</span>;
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Admin — Delete requests</h1>
      <p className="text-sm text-slate-400 mb-4">Requests from users asking for account deletion. Use with care.</p>

      {/* admin key */}
      {!adminKey ? (
        <div className="mb-4">
          <input
            placeholder="Paste admin key"
            value={tmpKey}
            onChange={(e) => setTmpKey(e.target.value)}
            className="w-full rounded-lg px-4 py-3 bg-slate-900 text-white mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!tmpKey) return setToast("Paste a key first");
                saveKey(tmpKey.trim());
              }}
              className="flex-1 rounded-xl bg-emerald-500 text-emerald-900 font-semibold py-3"
            >
              Unlock
            </button>
            <button onClick={() => setTmpKey("")} className="px-4 py-3 rounded-xl bg-slate-800">Clear</button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Admin key is stored in session only. Make sure the server ADMIN_API_KEY matches.</p>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1 text-sm text-slate-300">Session unlocked</div>
          <button onClick={fetchList} className="px-4 py-2 rounded-lg bg-slate-800">Refresh</button>
          <button onClick={() => { clearKey(); }} className="px-4 py-2 rounded-lg bg-rose-600 text-white">Lock</button>
        </div>
      )}

      {/* error */}
      {error && <div className="mb-3 rounded-md bg-rose-900/60 p-3 text-sm text-rose-100">{error}</div>}

      {/* main controls */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <button onClick={fetchList} className="px-6 py-3 bg-slate-800 rounded-xl">Refresh</button>
        <button onClick={runProcessor} className="px-6 py-3 bg-emerald-500 rounded-xl text-emerald-900 font-semibold">{processing ? "Processing…" : "Run processor"}</button>
        <button onClick={toggleSelectAll} className="px-5 py-3 bg-violet-600 rounded-xl">{selectAll ? "Clear all" : "Select all"}</button>
        <button onClick={() => setSelected({})} className="px-5 py-3 bg-slate-700 rounded-xl">Clear</button>
        <button onClick={exportCSV} className="px-5 py-3 bg-sky-600 rounded-xl">Export CSV</button>
        <button onClick={bulkComplete} className="px-6 py-3 bg-emerald-600 rounded-xl text-white">Bulk complete (delete)</button>
      </div>

      {/* list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="text-sm text-slate-400">No requests</div>
        ) : (
          requests.map((r) => {
            const isDeleted = r.status === "deleted";
            const checked = !!selected[r.id];
            return (
              <div key={r.id} className={`flex items-start gap-3 p-4 rounded-2xl border ${isDeleted ? "bg-slate-900/60 opacity-70" : "bg-slate-950/90"}`}>
                <div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isDeleted}
                    onChange={() => toggleSelect(r.id)}
                    className="h-5 w-5"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold leading-tight">{r.user_id}</div>
                      <div className="text-xs text-slate-400 mt-1">{r.reason || "No reason provided"}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">{fmtShort(r.created_at)}</div>
                      <div className="mt-1">{badgeFor(r.status)}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {isDeleted ? (
                      <div className="px-4 py-2 rounded-lg bg-rose-700 text-white font-semibold">Deleted — user removed</div>
                    ) : (
                      <>
                        <button
                          onClick={() => changeStatus(r.id, "processing")}
                          className="px-4 py-2 rounded-lg bg-sky-600 text-white"
                        >
                          Processing
                        </button>

                        <button
                          onClick={() => {
                            if (!confirm("Complete and delete the user now? This is irreversible.")) return;
                            changeStatus(r.id, "completed");
                          }}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold"
                        >
                          Complete (delete)
                        </button>

                        <button
                          onClick={() => changeStatus(r.id, "rejected")}
                          className="px-4 py-2 rounded-lg bg-rose-600 text-white"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* bottom note */}
      <div className="mt-6 text-xs text-slate-500">
        Use responsibly. Deleting accounts is permanent. This UI requires a valid ADMIN_API_KEY on the server.
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}