import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../lib/supabaseClient";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
      user_id,
    } = req.body;

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !user_id ||
      !amount
    ) {
      return res.status(400).json({ success: false });
    }

    // 🔐 Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false });
    }

    // ✅ Store topup record
    await supabase.from("wallet_topups").insert({
      user_id,
      amount,
      source: "razorpay",
      status: "success",
      payment_id: razorpay_payment_id,
    });

    // ✅ Update wallet balance (REAL CREDIT)
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user_id)
      .maybeSingle();

    const newBalance = Number(wallet?.balance || 0) + Number(amount);

    await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("user_id", user_id);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Verify payment error:", err);
    return res.status(500).json({ success: false });
  }
}