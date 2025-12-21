import { supabase } from "./supabaseClient";

export async function insertLedgerEntry({
  user_id,
  source_type,
  source_id,
  points,
  weight = 1,
}: {
  user_id: string;
  source_type: string;
  source_id: string;
  points: number;
  weight?: number;
}) {
  const { error } = await supabase.from("ledger").insert([
    {
      user_id,
      source_type,
      source_id,
      points,
      weight,
    },
  ]);

  if (error) {
    console.error("Ledger insert failed:", error);
  }
}