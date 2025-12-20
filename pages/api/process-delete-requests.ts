// pages/api/process-delete-requests.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
const ADMIN_KEY = process.env.ADMIN_API_KEY;

function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const header = (req.headers["x-admin-key"] || "").toString();
  if (!ADMIN_KEY || !header || header !== ADMIN_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    // Safety policy:
    // Only fully delete accounts that have status = 'completed' and were completed > 24 hours ago.
    // This gives manual undo time. Adjust timeframe as needed.
    const { data: requests, error: rErr } = await supabaseAdmin
      .from("account_delete_requests")
      .select("*")
      .eq("status", "completed")
      .lt("updated_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .limit(200);

    if (rErr) throw rErr;

    let processed = 0;
    for (const reqRow of requests || []) {
      const userId = (reqRow as any).user_id;
      if (!userId) continue;

      // 1) delete user's app data as required. Example below deletes row in users table.
      // Adjust to your DB model: remove items, ownerships, payments etc. Below is a minimal example.
      await supabaseAdmin.from("ownerships").delete().eq("user_id", userId);
      await supabaseAdmin.from("wallets").delete().eq("user_id", userId);
      // delete the auth user (supabase auth)
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (e) {
        console.warn("delete user (auth) error", e);
      }

      // mark the request processed
      await supabaseAdmin
        .from("account_delete_requests")
        .update({ status: "deleted", updated_at: new Date().toISOString() })
        .eq("id", (reqRow as any).id);

      processed++;
    }

    return res.status(200).json({ ok: true, processed });
  } catch (err: any) {
    console.error("process-delete-requests error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}