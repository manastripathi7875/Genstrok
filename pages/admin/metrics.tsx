import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Metrics() {
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    async function load() {
      const users = await supabase.from("profiles").select("id", { count: "exact" });
      const tasks = await supabase.from("task_proofs").select("id", { count: "exact" });
      const wallet = await supabase.from("wallets").select("balance");

      const totalWallet = wallet.data?.reduce((s, w) => s + Number(w.balance), 0) || 0;

      setStats({
        users: users.count,
        tasks: tasks.count,
        totalWallet,
      });
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Genstrok Metrics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Total Users</p>
          <p className="text-2xl font-bold">{stats.users}</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Tasks Completed</p>
          <p className="text-2xl font-bold">{stats.tasks}</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Wallet Value</p>
          <p className="text-2xl font-bold">₹{stats.totalWallet}</p>
        </div>
      </div>
    </div>
  );
}