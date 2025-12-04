import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Item = {
  id: string;
  title: string;
  price: number;
  cover_url: string;
  stock: number;
};

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("Items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      setErrorText(error.message);
    } else {
      setItems((data || []) as Item[]);
      setErrorText("");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
  }, []);

  async function handleClaim(item: Item) {
    if (!buyerName.trim()) {
      setActionMsg("Pehle upar apna naam / email likho.");
      return;
    }
    if (!item.stock || item.stock <= 0) {
      setActionMsg("Ye item out of stock hai.");
      return;
    }

    setActionMsg("Processing claim...");

    const { error: ownError } = await supabase.from("ownership").insert([
      {
        item_id: item.id,
        buyer_name: buyerName,
      },
    ]);

    if (ownError) {
      console.log(ownError);
      setActionMsg("Error (ownership): " + ownError.message);
      return;
    }

    const { error: updError } = await supabase
      .from("Items")
      .update({ stock: (item.stock || 0) - 1 })
      .eq("id", item.id);

    if (updError) {
      console.log(updError);
      setActionMsg(
        "Ownership save ho gayi, par stock update nahi hua."
      );
    } else {
      setActionMsg("Claimed: " + item.title);
      fetchItems();
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
        background: "#f3f4f6",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          background: "white",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            Protera Marketplace
          </h1>
          <a
            href="/admin"
            style={{
              padding: "6px 12px",
              background: "#2563eb",
              color: "white",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Admin
          </a>
        </div>
        <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 12 }}>
          Ye page Supabase database se real items dikhata hai. Ab tum items
          claim bhi kar sakte ho.
        </p>

        {errorText && (
          <p style={{ color: "red", fontSize: 12, marginBottom: 8 }}>
            Error: {errorText}
          </p>
        )}
        {actionMsg && (
          <p style={{ fontSize: 12, marginBottom: 8 }}>{actionMsg}</p>
        )}

        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: "#f9fafb",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            Apna naam ya email likho (claim ke record ke liye):
          </div>
          <input
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="e.g. Aman / aman@email.com"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              fontSize: 13,
            }}
          />
        </div>

        {loading && <p>Loading items...</p>}

        {!loading && items.length === 0 && (
          <p>Abhi table me koi item nahi mila.</p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {items.map((item) => {
            const imageSrc =
              item.cover_url && item.cover_url.trim() !== ""
                ? item.cover_url
                : "https://picsum.photos/seed/" + item.id + "/200";

            const isOut = !item.stock || item.stock <= 0;

            return (
              <div
                key={item.id}
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    height: 80,
                    overflow: "hidden",
                    background: "#e5e7eb",
                  }}
                >
                  <img
                    src={imageSrc}
                    alt={item.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
                <div style={{ padding: 8, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#4b5563" }}>
                    ₹{item.price} • stock: {item.stock ?? 0}
                  </div>
                </div>
                <button
                  onClick={() => handleClaim(item)}
                  disabled={isOut}
                  style={{
                    margin: 8,
                    padding: 8,
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    background: isOut ? "#d1d5db" : "#111827",
                    color: isOut ? "#4b5563" : "white",
                    opacity: isOut ? 0.6 : 1,
                    cursor: isOut ? "not-allowed" : "pointer",
                  }}
                >
                  {isOut ? "Out of stock" : "Claim"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
