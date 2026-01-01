import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function ChatListPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadChats() {
      setLoading(true);

      const { data } = await supabase
        .from("chats")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false });

      setChats(data || []);
      setLoading(false);
    }

    loadChats();
  }, [user]);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <h1 className="text-sm font-semibold mb-4">💬 Chats</h1>

      {chats.length === 0 ? (
        <p className="text-xs text-slate-400">
          No chats yet. Start from a profile.
        </p>
      ) : (
        <div className="space-y-2">
          {chats.map((c) => {
            const otherUser =
              c.user_a === user.id ? c.user_b : c.user_a;

            return (
              <button
                key={c.id}
                onClick={() => router.push(`/chat/${c.id}`)}
                className="w-full text-left rounded-xl border border-slate-800 bg-slate-950/80 p-3 hover:bg-slate-900"
              >
                <p className="text-sm font-semibold">
                  Chat with {otherUser.slice(0, 6)}…
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}