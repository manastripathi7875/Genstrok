import type { NextApiRequest, NextApiResponse } from "next";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, user_id } = req.body;

    // 🔒 Hard validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // ₹ → paise
      currency: "INR",
      receipt: `wallet_${user_id}_${Date.now()}`,
      notes: {
        user_id: user_id, // 🔥 MOST IMPORTANT LINE
        purpose: "wallet_topup",
      },
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay order error:", err);
    return res.status(500).json({ error: "Order creation failed" });
  }
}