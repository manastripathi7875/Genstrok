import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");

  async function request() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    if (Number(amount) < 100) {
      alert("Minimum withdrawal ₹100");
      return;
    }

    await supabase.from("withdrawal_requests").insert({
      user_id: auth.user.id,
      amount: Number(amount),
    });

    alert("Withdrawal request submitted");
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-xl font-bold">Withdraw</h1>

      <input
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Enter amount"
        className="mt-4 w-full bg-slate-900 border border-slate-700 p-3 rounded-xl"
      />

      <button
        onClick={request}
        className="mt-4 w-full bg-violet-500 text-black py-2 rounded-xl font-semibold"
      >
        Request Withdrawal
      </button>
    </div>
  );
}