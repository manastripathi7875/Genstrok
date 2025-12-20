// pages/api/flags.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin"; // service role client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("key, enabled");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}