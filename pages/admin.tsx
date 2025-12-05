import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type Item = {
  id: string;
  title: string;
  price: number;
  stock: number;
  cover_url: string | null;
  creator_name?: string | null;
};

export default function Admin() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [stock, setStock] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState("");
  const [creator, setCreator] = useState("");
  const [file, setFile] = useState<File | null>(null);
const [adminUser, setAdminUser] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("items")
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
  async function init() {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setAdminUser(data.user);
    }
    fetchItems();
  }
  init();
}, []);

  function resetForm() {
    setTitle("");
    setPrice("");
    setStock("");
    setCoverUrl("");
    setCreator("");
    setFile(null);
    setEditingId(null);
  }

  async function uploadImageIfNeeded(): Promise<string | null> {
    if (!file) {
      return coverUrl.trim() || null;
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filePath =
      "items/" +
      Date.now().toString() +
      "-" +
      Math.random().toString(36).slice(2) +
      "." +
      ext;

    const { data, error } = await supabase.storage
      .from("item-images")
      .upload(filePath, file);

    if (error || !data) {
      console.log(error);
      throw new Error(
        "Image upload failed: " + (error?.message || "unknown")
      );
    }

    const { data: publicData } = supabase.storage
      .from("item-images")
      .getPublicUrl(data.path);

    return publicData.publicUrl || null;
  }

  async function handleSave(e: any) {
    e.preventDefault();

    if (!title.trim()) {
      setErrorText("Title is required");
      return;
    }

    const priceNumber = Number(price) || 0;
    const stockNumber = Number(stock) || 0;

    setSaving(true);
    setErrorText("");

    let imageUrl: string | null = null;

    try {
      imageUrl = await uploadImageIfNeeded();
    } catch (err: any) {
      setSaving(false);
      setErrorText(err.message || "Image upload failed");
      return;
    }

    const payload = {
      title: title.trim(),
      price: priceNumber,
      stock: stockNumber,
      cover_url: imageUrl,
      creator_name: creator.trim() || null,
      creator_id: adminUser ? adminUser.id : null,   // 👈 IMPORTANT
    };

    if (editingId) {
      const { error } = await supabase
        .from("items")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        console.log(error);
        setErrorText(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("items").insert([payload]);
      if (error) {
        console.log(error);
        setErrorText(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    resetForm();
    fetchItems();
  }

  async function handleEdit(item: Item) {
    setEditingId(item.id);
    setTitle(item.title);
    setPrice(String(item.price ?? ""));
    setStock(String(item.stock ?? ""));
    setCoverUrl(item.cover_url ?? "");
    setCreator(item.creator_name ?? "");
    setFile(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) {
      console.log(error);
      setErrorText(error.message);
    }
    fetchItems();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-10 pt-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {BRAND.name} admin
            </h1>
            <p className="text-[11px] text-slate-400">
              Create drops, upload covers, manage stock.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              View market
            </a>
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              Logout
            </button>
          </div>
        </header>

        {/* form */}
        <section className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/70 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {editingId ? "Edit drop" : "Add new drop"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] text-sky-300 underline"
              >
                Cancel edit
              </button>
            )}
          </div>

          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-100"
                placeholder="Hand made clay lamp"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">
                Creator name (optional)
              </label>
              <input
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-100"
                placeholder="Aman / Studio XYZ"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">
                Price (₹)
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-100"
                placeholder="499"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">
                Stock
              </label>
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                type="number"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-100"
                placeholder="10"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] text-slate-300">
                Cover image URL (optional)
              </label>
              <input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-100"
                placeholder="https://example.com/image.jpg"
              />
              <label className="mt-2 block text-[11px] text-slate-300">
                Or upload image file
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e: any) =>
                  setFile(e.target.files?.[0] || null)
                }
                className="w-full text-[11px] text-slate-300"
              />
              <p className="text-[10px] text-slate-500">
                If you choose a file, it will be uploaded to
                storage and used as the cover.
              </p>
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60"
              >
                {editingId ? "Save changes" : "Add drop"}
              </button>
            </div>
          </form>

          {errorText && (
            <p className="mt-2 text-[11px] text-red-300">
              Error: {errorText}
            </p>
          )}
        </section>

        {/* items list */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-100">
            All drops ({items.length})
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl bg-slate-900/80"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-400">
              No items yet. Add your first drop above.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const imageSrc = item.cover_url?.trim()
                  ? item.cover_url
                  : `https://picsum.photos/seed/${item.id}/300`;
                return (
                  <article
                    key={item.id}
                    className="flex gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 shadow-sm shadow-slate-950/60 backdrop-blur"
                  >
                    <div className="h-20 w-20 overflow-hidden rounded-xl bg-slate-800/80">
                      <img
                        src={imageSrc}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-50 line-clamp-2">
                        {item.title}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        ₹{item.price} • Stock: {item.stock ?? 0}
                      </div>
                      {item.creator_name && (
                        <div className="mt-1 text-[11px] text-sky-300">
                          By {item.creator_name}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-full bg-red-500/90 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}