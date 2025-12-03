import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [stock, setStock] = useState("");
  const [msg, setMsg] = useState("");

  async function addItem(e) {
    e.preventDefault();
    setMsg("Adding item...");

    const { data, error } = await supabase.from("items").insert([
      {
        title: title,
        price: Number(price),
        cover_url: coverUrl,
        stock: Number(stock),
      },
    ]);

    if (error) {
      setMsg("❌ Error: " + error.message);
    } else {
      setMsg("✅ Item added successfully!");
      setTitle("");
      setPrice("");
      setCoverUrl("");
      setStock("");
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
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin – Add Item</h1>

        <form onSubmit={addItem} style={{ marginTop: 16 }}>
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              marginBottom: 12,
              border: "1px solid #ddd",
            }}
            placeholder="Handmade clay lamp"
            required
          />

          <label>Price</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              marginBottom: 12,
              border: "1px solid #ddd",
            }}
            type="number"
            placeholder="499"
            required
          />

          <label>Image URL</label>
          <input
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              marginBottom: 12,
              border: "1px solid #ddd",
            }}
            placeholder="https://picsum.photos/300"
            required
          />

          <label>Stock</label>
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            type="number"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              marginBottom: 12,
              border: "1px solid #ddd",
            }}
            placeholder="10"
            required
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: 12,
              background: "black",
              color: "white",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Add Item
          </button>
        </form>

        {msg && (
          <p
            style={{
              marginTop: 16,
              padding: 10,
              background: "#f3f4f6",
              borderRadius: 8,
            }}
          >
            {msg}
          </p>
        )}
      </div>
    </main>
  );
}
