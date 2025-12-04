import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { getSession, signOut } from "../lib/auth";
import { Button, Input, Card, CardContent, Loading, EmptyState } from "../components/UI";

interface Item {
  id: number;
  title: string;
  price: number;
  stock: number;
  cover_url: string;
  created_at?: string;
}

export default function Admin() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    stock: "",
    cover_url: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const session = await getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setIsAuthenticated(true);
      fetchItems();
    } catch (err) {
      router.push("/login");
    }
  }

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

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

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
        resetForm();
        fetchItems();
      }
    } else {
      const { error } = await supabase.from("Items").insert([itemData]);

      if (error) {
        alert("Error adding item: " + error.message);
      } else {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const { error } = await supabase.from("Items").delete().eq("id", id);

    if (error) {
      alert("Error deleting item: " + error.message);
    } else {
      fetchItems();
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loading size="lg" text="Checking authentication..." />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-protera-700">Admin Panel</h1>
          <div className="flex gap-2">
            <a
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              View Store
            </a>
            <Button variant="secondary" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent>
            <h2 className="text-lg font-semibold mb-4">
              {editingItem ? "Edit Item" : "Add New Item"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Price (₹)"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  required
                  min="0"
                  step="0.01"
                />
                <Input
                  type="number"
                  label="Stock"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                  required
                  min="0"
                />
              </div>
              <Input
                type="url"
                label="Image URL"
                value={formData.cover_url}
                onChange={(e) =>
                  setFormData({ ...formData, cover_url: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
              />
              <div className="flex gap-2">
                <Button type="submit" loading={saving}>
                  {editingItem ? "Update Item" : "Add Item"}
                </Button>
                {editingItem && (
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4">
              All Items ({items.length})
            </h2>

            {loading ? (
              <Loading text="Loading items..." />
            ) : items.length === 0 ? (
              <EmptyState
                title="No items yet"
                description="Add your first item using the form above"
              />
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                  >
                    {item.cover_url && (
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-sm text-gray-500">
                        ₹{item.price} | Stock: {item.stock}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => handleEdit(item)}
                        className="text-sm px-3 py-1"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => handleDelete(item.id)}
                        className="text-sm px-3 py-1"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
