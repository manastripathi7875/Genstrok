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
    const { amount, userId } = req.body;

    if (!amount || amount <= 0 || !userId) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // rupees to paise
      currency: "INR",
      receipt: `wallet_${userId}_${Date.now()}`,
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Order creation failed" });
  }
}