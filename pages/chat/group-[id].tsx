import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function GroupChatPage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");

  /* AUTH */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  /* LOAD MESSAGES */
  useEffect(() => {
    if (!id) return;

    async function load() {
      const { data } = await supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", id)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }

    load();

    // realtime
    const channel = supabase
      .channel("group-chat-" + id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function send() {
    if (!text.trim() || !user) return;

    await supabase.from("group_messages").insert({
      group_id: id,
      user_id: user.id,
      message: text,
    });

    setText("");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="p-3 border-b border-slate-800 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xs">
          ← Back
        </button>
        <p className="text-sm font-semibold">Group Chat</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
              m.user_id === user?.id
                ? "ml-auto bg-violet-500 text-black"
                : "bg-slate-800 text-slate-200"
            }`}
          >
            {m.message}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-800 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          placeholder="Message group…"
        />
        <button
          onClick={send}
          className="rounded-xl bg-violet-500 px-4 text-sm font-semibold text-black"
        >
          Send
        </button>
      </div>
    </div>
  );
}