import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabaseClient";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("Items")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({ error: "Item not found" });
    }
    return res.status(200).json(data);
  }

  if (req.method === "PUT") {
    const { title, price, stock, cover_url } = req.body;

    const { data, error } = await supabase
      .from("Items")
      .update({ title, price, stock, cover_url })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const { error } = await supabase.from("Items").delete().eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ message: "Item deleted successfully" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
