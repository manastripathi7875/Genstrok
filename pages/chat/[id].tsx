import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ChatRoom() {
  const router = useRouter();
  const { id } = router.query;

  const chatId = typeof id === "string" ? id : null;

  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [chatUsers, setChatUsers] = useState<{
    user_a: string;
    user_b: string;
  } | null>(null);

  const [text, setText] = useState("");

  useEffect(() => {
  if (!id || !user) return;

  if (String(id).startsWith("group-")) {
    const groupId = String(id).replace("group-", "");

    supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          alert("You are not a member of this group");
          router.replace("/groups");
        }
      });
  }
}, [id, user]);

  /* ================= AUTH ================= */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  /* ================= LOAD CHAT USERS ================= */

  useEffect(() => {
    if (!chatId) return;

    supabase
      .from("chats")
      .select("user_a, user_b")
      .eq("id", chatId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setChatUsers(data);
      });
  }, [chatId]);

  /* ================= LOAD MESSAGES + REALTIME ================= */

  useEffect(() => {
    if (!chatId) return;

    async function loadMessages() {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }

    loadMessages();

    const channel = supabase
      .channel("chat-messages-" + chatId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  /* ================= LOAD OFFERS + REALTIME ================= */

  useEffect(() => {
    if (!chatId) return;

    supabase
      .from("work_offers")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setOffers(data || []));

    const channel = supabase
      .channel("work-offers-" + chatId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "work_offers",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setOffers((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  /* ================= SEND MESSAGE ================= */

  async function sendMessage() {
    if (!text.trim() || !user || !chatId) return;

    await supabase.from("chat_messages").insert({
      chat_id: chatId,
      sender_id: user.id,
      message: text,
    });

    setText("");
  }

  /* ================= SEND WORK OFFER ================= */

  async function sendOffer() {
    if (!user || !chatId || !chatUsers) return;

    const title = prompt("Work title?");
    const reward = prompt("Coins reward?");
    if (!title || !reward) return;

    const receiverId =
      chatUsers.user_a === user.id
        ? chatUsers.user_b
        : chatUsers.user_a;

    await supabase.from("work_offers").insert({
      chat_id: chatId,
      sender_id: user.id,
      receiver_id: receiverId,
      title,
      reward_coins: Number(reward),
      status: "pending",
    });
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* HEADER */}
      <header className="p-3 border-b border-slate-800">
        <button onClick={() => router.back()} className="text-xs">
          ← Back
        </button>
      </header>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
              m.sender_id === user?.id
                ? "ml-auto bg-violet-500 text-slate-950"
                : "bg-slate-800 text-slate-200"
            }`}
          >
            {m.message}
          </div>
        ))}

        {/* WORK OFFERS */}
        {offers.map((o) => (
          <div
            key={o.id}
            className="rounded-xl border border-emerald-600/40 bg-emerald-500/10 p-3 text-xs"
          >
            <p className="font-semibold">💼 {o.title}</p>
            <p className="text-[11px] text-slate-300">
              Reward: {o.reward_coins} coins
            </p>

            {o.status === "pending" && o.receiver_id === user?.id && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={async () => {
                    // accept offer
                    await supabase
                      .from("work_offers")
                      .update({ status: "accepted" })
                      .eq("id", o.id);

                    // create mission
                    await supabase.from("missions").insert({
                      title: o.title || "Work task",
                      reward_coins: o.reward_coins || 100,
                      assigned_to: o.receiver_id,
                    });
                  }}
                  className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950"
                >
                  Accept
                </button>

                <button
                  onClick={() =>
                    supabase
                      .from("work_offers")
                      .update({ status: "rejected" })
                      .eq("id", o.id)
                  }
                  className="rounded-full border border-slate-600 px-3 py-1 text-[11px]"
                >
                  Reject
                </button>
              </div>
            )}

            {o.status !== "pending" && (
              <p className="mt-1 text-[10px] text-slate-400">
                Status: {o.status}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* INPUT */}
      <div className="p-3 border-t border-slate-800 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          placeholder="Type a message…"
        />
        <button
          onClick={sendMessage}
          className="rounded-xl bg-violet-500 px-4 text-sm font-semibold text-slate-950"
        >
          Send
        </button>
        <button
          onClick={sendOffer}
          className="rounded-xl border border-slate-700 px-3 text-xs text-slate-200"
        >
          💼 Offer
        </button>
      </div>
    </div>
  );
}