import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Item {
  id: number;
  title: string;
  price: number;
  stock: number;
  cover_url: string;
  created_at?: string;
}

export default function Admin() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    stock: "",
    cover_url: "",
  });

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("Items")
      .select("*")
      .order("created_at", { ascending: false });

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

  function resetForm() {
    setFormData({ title: "", price: "", stock: "", cover_url: "" });
    setEditingItem(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const itemData = {
      title: formData.title,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      cover_url: formData.cover_url,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("Items")
        .update(itemData)
        .eq("id", editingItem.id);

      if (error) {
        alert("Error updating item: " + error.message);
      } else {
        alert("Item updated successfully!");
        resetForm();
        fetchItems();
      }
    } else {
      const { error } = await supabase.from("Items").insert([itemData]);

      if (error) {
        alert("Error adding item: " + error.message);
      } else {
        alert("Item added successfully!");
        resetForm();
        fetchItems();
      }
    }
    setSaving(false);
  }

  function handleEdit(item: Item) {
    setEditingItem(item);
    setFormData({
      title: item.title,
      price: item.price.toString(),
      stock: item.stock.toString(),
      cover_url: item.cover_url || "",
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const { error } = await supabase.from("Items").delete().eq("id", id);

    if (error) {
      alert("Error deleting item: " + error.message);
    } else {
      alert("Item deleted successfully!");
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
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin Panel</h1>
          <a
            href="/"
            style={{
              padding: "8px 16px",
              background: "#6b7280",
              color: "white",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            View Store
          </a>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            {editingItem ? "Edit Item" : "Add New Item"}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  Price (₹)
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  required
                  min="0"
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  Stock
                </label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                  required
                  min="0"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Image URL
              </label>
              <input
                type="url"
                value={formData.cover_url}
                onChange={(e) =>
                  setFormData({ ...formData, cover_url: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "10px 20px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingItem
                  ? "Update Item"
                  : "Add Item"}
              </button>
              {editingItem && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: "10px 20px",
                    background: "#e5e7eb",
                    color: "#374151",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            All Items ({items.length})
          </h2>

          {loading && <p>Loading items...</p>}

          {!loading && items.length === 0 && (
            <p style={{ color: "#6b7280" }}>No items yet. Add your first item above!</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#f9fafb",
                }}
              >
                {item.cover_url && (
                  <img
                    src={item.cover_url}
                    alt={item.title}
                    style={{
                      width: 60,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 6,
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    ₹{item.price} | Stock: {item.stock}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleEdit(item)}
                    style={{
                      padding: "6px 12px",
                      background: "#fbbf24",
                      color: "#1f2937",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      padding: "6px 12px",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
