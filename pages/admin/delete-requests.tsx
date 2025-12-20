// pages/api/admin/delete-requests.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin"; // make sure this file exists and uses service role
const ADMIN_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_KEY) {
  console.warn("ADMIN_API_KEY not set — admin endpoints will reject requests");
}

function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const header = (req.headers["x-admin-key"] || "").toString();
  if (!ADMIN_KEY || !header || header !== ADMIN_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      // list delete requests
      const { data, error } = await supabaseAdmin
        .from("account_delete_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return res.status(200).json({ requests: data || [] });
    }

    if (req.method === "POST") {
      // update a single request status { id, status, reason? }
      const { id, status, reason } = req.body || {};
      if (!id || !status) return res.status(400).json({ error: "Missing id or status" });

      const payload: any = { status, updated_at: new Date().toISOString() };
      if (typeof reason === "string") payload.reason = reason;

      const { error } = await supabaseAdmin
        .from("account_delete_requests")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (err: any) {
    console.error("admin/delete-requests error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}