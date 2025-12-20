// pages/api/admin/bulk-delete-items.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // simple header check (server-only env is authoritative)
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids required" });
  }

  try {
    // delete ownerships or related rows first if you have foreign keys
    // example: await supabaseAdmin.from("ownerships").delete().in("item_id", ids);

    // then delete items
    const { error } = await supabaseAdmin.from("items").delete().in("id", ids);
    if (error) {
      console.error("bulk delete error", error);
      return res.status(500).json({ error: error.message || "delete failed" });
    }

    return res.status(200).json({ deleted: ids.length });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}