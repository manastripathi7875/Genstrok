import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  api: {
    bodyParser: false,
  },
};

function buffer(req: any) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const buf = await buffer(req);
  const sig = req.headers["x-razorpay-signature"] as string;

  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(buf)
    .digest("hex");

  if (sig !== expectedSig) {
    return res.status(400).send("Invalid signature");
  }

  const event = JSON.parse(buf.toString());

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const receipt = payment.notes?.receipt || payment.receipt || "";

    const userId = receipt.split("_")[1];
    const amount = payment.amount / 100;

    if (userId) {
      await supabaseAdmin.rpc("increment_wallet_balance", {
        p_user_id: userId,
        p_amount: amount,
      });
    }
  }

  res.status(200).json({ status: "ok" });
}