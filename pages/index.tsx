import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchItems() {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.log("Error:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
  }, []);

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
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Protera Marketplace
        </h1>
        <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 12 }}>
          Ye page ab Supabase database se real items dikhayega.
        </p>

        {loading && <p>Loading items...</p>}

        {!loading && items.length === 0 && (
          <p>Abhi table me koi item nahi mila.</p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 12,
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <div style={{ height: 80, overflow: "hidden" }}>
                <img
                  src={item.cover_url}
                  alt={item.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
              <div style={{ padding: 8 }}>
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
                  ₹{item.price} • stock: {item.stock}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}