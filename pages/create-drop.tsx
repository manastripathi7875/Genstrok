// pages/create-drop.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

export default function CreateDropPage() {
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0");
  const [stock, setStock] = useState("1");
  const [creatorName, setCreatorName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setNeedsLogin(true);
        return;
      }
      setUser(data.user);
      const defaultName =
        data.user.user_metadata?.full_name ||
        data.user.email?.split("@")[0] ||
        "";
      setCreatorName(defaultName);
    }
    loadUser();
  }, []);

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!user) {
      setNeedsLogin(true);
      return;
    }

    if (!title.trim()) {
      setMsg("Please add a title.");
      return;
    }

    setSaving(true);
    setMsg("Creating drop…");

    let finalImageUrl = imageUrl.trim() || "";

    try {
      // if file selected, upload to Supabase storage
      if (file) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("item-images") // change bucket name if yours is different
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("item-images")
          .getPublicUrl(filePath);

        finalImageUrl = publicData.publicUrl;
      }

      const numericPrice = Number(price) || 0;
      const numericStock = Number(stock) || 0;

      const { data, error } = await supabase
        .from("items")
        .insert([
          {
            title: title.trim(),
            price: numericPrice,
            stock: numericStock,
            cover_url: finalImageUrl || null,
            creator_name: creatorName.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setMsg("Drop created successfully ✅");
      setTitle("");
      setPrice("0");
      setStock("1");
      setImageUrl("");
      setFile(null);

      // optional: go to drop page
      if (data?.id && typeof window !== "undefined") {
        setTimeout(() => {
          window.location.href = `/drop/${data.id}`;
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setMsg("Error creating drop: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (needsLogin && !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-xs text-center">
          <h1 className="text-lg font-semibold mb-2">
            Sign in to create a drop
          </h1>
          <p className="text-sm text-slate-400 mb-3">
            You need a Genstrok account before you can upload drops.
          </p>
          <a
            href="/auth"
            className="inline-flex rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400"
          >
            Go to login →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-md px-4 pt-5 pb-8">
        <header className="mb-4 flex items-center justify-between">
          <a
            href="/"
            className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-200"
          >
            ← Back to market
          </a>
          <div className="text-right">
            <p className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
              New drop
            </p>
            <h1 className="text-base font-semibold">
              Create a {BRAND.name} drop
            </h1>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl shadow-black/60">
          <form onSubmit={handleSubmit} className="space-y-3 text-[11px]">
            <div>
              <label className="block mb-1 text-slate-300">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                placeholder="Example: Hand made clay lamp"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 text-slate-300">
                  Price (₹)
                </label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  min="0"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-300">
                  Stock
                </label>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-slate-300">
                Creator name
              </label>
              <input
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                placeholder="Your public name"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-slate-300">
                Cover image
              </label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                placeholder="Paste image URL (optional)"
              />
              <div className="text-[10px] text-slate-500">
                or upload from your phone:
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setFile(
                    e.target.files && e.target.files[0]
                      ? e.target.files[0]
                      : null
                  )
                }
                className="w-full text-[10px] text-slate-300"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 w-full rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Publishing…" : "Publish drop"}
            </button>

            {msg && (
              <p className="mt-2 text-[11px] text-slate-300">
                {msg}
              </p>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}