import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).end("Method not allowed");
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  const chunks: Buffer[] = [];

  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const rawBody = Buffer.concat(chunks);
    const receivedSignature = req.headers["x-razorpay-signature"] as string;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== receivedSignature) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody.toString());

    if (event.event !== "payment.captured") {
      return res.json({ status: "ignored" });
    }

    const payment = event.payload.payment.entity;

    const paymentId = payment.id;
    const amount = payment.amount / 100; // paise → rupees
    const userId = payment.notes?.user_id;

    if (!userId) {
      return res.status(400).json({ error: "Missing user_id in notes" });
    }

    // 1️⃣ Prevent double credit
    const { data: existing } = await supabase
      .from("wallet_topups")
      .select("id")
      .eq("razorpay_payment_id", paymentId)
      .maybeSingle();

    if (existing) {
      return res.json({ status: "already_processed" });
    }

    // 2️⃣ Insert topup record
    await supabase.from("wallet_topups").insert({
      user_id: userId,
      razorpay_payment_id: paymentId,
      amount,
      status: "success",
    });

    // 3️⃣ Credit wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const newBalance = (wallet?.balance || 0) + amount;

    await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("user_id", userId);

    return res.json({ status: "wallet_credited" });
  });
}