// pages/api/user-settings.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = req.method || "GET";

  // Expect Authorization: Bearer <token> header forwarded from client if checking server-side.
  // Simpler: client interacts with supabase-js directly to read/write user_settings.
  try {
    if (method === "GET") {
      const { user_id } = req.query;
      if (!user_id) return res.status(400).json({ error: "user_id missing" });

      const { data, error } = await supabaseAdmin
        .from("user_settings")
        .select("key, value")
        .eq("user_id", user_id);

      if (error) throw error;
      return res.status(200).json({ settings: data });
    }

    // POST: create or update key
    if (method === "POST") {
      const { user_id, key, value } = req.body;
      if (!user_id || !key) return res.status(400).json({ error: "missing fields" });

      const { error } = await supabaseAdmin
        .from("user_settings")
      .upsert(
        { user_id, key, value: value ?? {} },
        { onConflict: "user_id,key" }
      );

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}