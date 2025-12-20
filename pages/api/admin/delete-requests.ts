// pages/api/admin/delete-requests.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin"; // <- adjust relative path if needed

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

async function deleteUserCompletely(userId: string) {
  // Customize these deletions for your schema; these are common example tables
  try {
    await supabaseAdmin.from("ownerships").delete().eq("user_id", userId);
  } catch (e) {
    console.warn("ownerships delete failed", e);
  }
  try {
    await supabaseAdmin.from("wallets").delete().eq("user_id", userId);
  } catch (e) {
    console.warn("wallets delete failed", e);
  }
  try {
    await supabaseAdmin.from("items").delete().eq("creator_id", userId);
  } catch (e) {
    console.warn("items delete failed", e);
  }
  try {
    await supabaseAdmin.from("claims").delete().eq("user_id", userId);
  } catch (e) {
    console.warn("claims delete failed", e);
  }
  // Remove any storage objects if you store user files (example - adjust bucket & path)
  // await supabaseAdmin.storage.from('user-uploads').remove([`users/${userId}/avatar.jpg`]);

  // finally delete the auth user (requires service role key)
  try {
    await supabaseAdmin.auth.admin.deleteUser(userId);
  } catch (e) {
    console.warn("supabase auth deleteUser failed", e);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("account_delete_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return res.status(200).json({ requests: data || [] });
    }

    if (req.method === "POST") {
      // POST body: { id, status, reason? }
      const { id, status, reason } = req.body || {};
      if (!id || !status) return res.status(400).json({ error: "Missing id or status" });

      // Load the request row to get user_id
      const { data: rows, error: rerr } = await supabaseAdmin
        .from("account_delete_requests")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (rerr) throw rerr;
      if (!rows) return res.status(404).json({ error: "Request not found" });

      const userId = (rows as any).user_id;

      if (status === "completed") {
        // Immediate destructive path: delete user and related data now
        if (!userId) {
          // still mark as deleted even if user id missing
          await supabaseAdmin.from("account_delete_requests").update({
            status: "deleted",
            reason: reason ?? (rows as any).reason ?? null,
            updated_at: new Date().toISOString(),
          }).eq("id", id);

          return res.status(200).json({ ok: true, deleted: false, note: "No user_id in request, marked deleted" });
        }

        // Do deletion steps (wrap in try/catch so one failure won't block DB update)
        try {
          await deleteUserCompletely(userId);
        } catch (e) {
          console.error("deleteUserCompletely error", e);
          // continue to mark request even if some deletes failed
        }

        // mark request deleted
        const { error: uerr } = await supabaseAdmin
          .from("account_delete_requests")
          .update({
            status: "deleted",
            updated_at: new Date().toISOString(),
            reason: reason ?? (rows as any).reason ?? null,
          })
          .eq("id", id);

        if (uerr) throw uerr;

        return res.status(200).json({ ok: true, deleted: true });
      } else {
        // non-destructive status update (requested, processing, rejected, etc.)
        const payload: any = { status, updated_at: new Date().toISOString() };
        if (typeof reason === "string") payload.reason = reason;

        const { error } = await supabaseAdmin
          .from("account_delete_requests")
          .update(payload)
          .eq("id", id);

        if (error) throw error;
        return res.status(200).json({ ok: true, updated: true });
      }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (err: any) {
    console.error("admin/delete-requests error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}