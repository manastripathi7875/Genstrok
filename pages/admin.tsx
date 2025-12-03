import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Item = {
  id: string;
  title: string;
  price: number;
  cover_url: string;
  stock: number;
};

export default function Admin() {
  // auth state
  const [user, setUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  // item form state
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [stock, setStock] = useState("");

  // items list
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");

  // on page load, check if already logged in
  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        fetchItems();
      }
    }
    checkUser();
  }, []);

  async function handleLogin(e: any) {
    e.preventDefault();
    setAuthMsg("Logging in...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthMsg("❌ " + error.message);
    } else {
      setAuthMsg("✅ Logged in");
      setUser(data.user);
      fetchItems();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setAuthMsg("Logged out");
    setItems([]);
  }

  async function fetchItems() {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      setMsg("❌ Error loading items");
    } else {
      setItems((data || []) as Item[]);
      setMsg("");
    }
  }

  async function addItem(e: any) {
    e.preventDefault();
    setMsg("Adding item...");

    const { error } = await supabase.from("items").insert([
      {
        title,
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
          maxWidth: 520,
          margin: "0 auto",
          background: "white",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Admin Panel</h1>

          <a
            href="/"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            View Store
          </a>
        </header>

        {/* If not logged in: show login form */}
        {!user && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#f9fafb",
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Login to admin
            </h2>
            <form onSubmit={handleLogin}>
              <input
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Admin email"
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  marginBottom: 8,
                  border: "1px solid #ddd",
                }}
                type="email"
                required
              />
              <input
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  marginBottom: 8,
                  border: "1px solid #ddd",
                }}
                type="password"
                required
              />
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: 10,
                  background: "black",
                  color: "white",
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                Login
              </button>
            </form>
            {authMsg && (
              <p
                style={{
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                {authMsg}
              </p>
            )}
          </div>
        )}

        {/* If logged in: show admin tools */}
        {user && (
          <>
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <span>Logged in as: {user.email}</span>
              <button
                onClick={handleLogout}
                style={{
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                }}
              >
                Logout
              </button>
            </div>

            <section
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background: "#f9fafb",
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Add New Item
              </h2>

              <form onSubmit={addItem}>
                <label>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    marginBottom: 8,
                    border: "1px solid #ddd",
                  }}
                  required
                />

                <label>Price</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    marginBottom: 8,
                    border: "1px solid #ddd",
                  }}
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
                    marginBottom: 8,
                    border: "1px solid #ddd",
                  }}
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
                  required
                />

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: 10,
                    background: "black",
                    color: "white",
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  Add Item
                </button>
              </form>

              {msg && (
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                  }}
                >
                  {msg}
                </p>
              )}
            </section>

            <section>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                All Items ({items.length})
              </h2>

              {items.length === 0 && (
                <p style={{ fontSize: 13 }}>No items yet.</p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      padding: 8,
                      background: "#f9fafb",
                    }}
                  >
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#e5e7eb",
                      }}
                    >
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
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#4b5563" }}>
                        ₹{item.price} | Stock: {item.stock}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}