// pages/create-drop.tsx
import { useEffect, useState, FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

export default function CreateDropPage() {
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [stock, setStock] = useState("1");
  const [creatorName, setCreatorName] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      console.log("auth.getUser", data, error);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!user) {
      setNeedsLogin(true);
      setMsg("You need to login first.");
      return;
    }

    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setMsg("Price must be valid.");
      return;
    }
    if (Number.isNaN(numericStock) || numericStock < 1) {
      setMsg("Stock must be at least 1.");
      return;
    }

    setSaving(true);
    setMsg("Creating drop...");

    let attachmentPath: string | null = null;
    let attachmentOriginalName: string | null = null;
    let attachmentMimeType: string | null = null;

    try {
      if (attachmentFile) {
        const bucketName = "item-images";
        const fileExt = attachmentFile.name.split(".").pop() || "bin";
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, attachmentFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error(uploadError);
          throw uploadError;
        }

        attachmentPath = filePath;
        attachmentOriginalName = attachmentFile.name;
        attachmentMimeType = attachmentFile.type || null;
      }

      console.log("inserting item for user", user.id);

      const { data, error } = await supabase
        .from("items")
        .insert([
          {
            title: title.trim(),
            description: description.trim() || null,
            price: numericPrice,
            stock: numericStock,
            cover_url: imageUrl.trim() || null,
            creator_name: creatorName.trim() || null,
             user_id: user?.id || null,
            attachment_path: attachmentPath,
            attachment_original_name: attachmentOriginalName,
            attachment_mime_type: attachmentMimeType,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("insert error", error);
        throw error;
      }

      setMsg("Drop created successfully ✅");
      setTitle("");
      setDescription("");
      setPrice("0");
      setStock("1");
      setImageUrl("");
      setAttachmentFile(null);

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

      <main className="relative mx-auto max-w-lg px-4 pt-6 pb-10">
        <header className="mb-6 flex items-center justify-between">
          <a
            href="/"
            className="rounded-full border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-[12px] text-slate-200"
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

        <section className="rounded-3xl border border-slate-800 bg-slate-950/95 p-5 shadow-xl shadow-black/60">
          <form onSubmit={handleSubmit} className="space-y-4 text-[12px]">
            <div>
              <label className="block mb-1.5 text-slate-200 text-[12px]">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                placeholder="Example: Hand made clay lamp"
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                This is the main name of your drop.
              </p>
            </div>

            <div>
              <label className="block mb-1.5 text-slate-200 text-[12px]">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70 resize-none"
                placeholder="Write anything: story, instructions, notes, experiment details..."
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Free text - long form allowed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1.5 text-slate-200 text-[12px]">
                  Price (₹)
                </label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-[13px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-slate-200 text-[12px]">
                  Stock
                </label>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  type="number"
                  min="1"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-[13px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  How many people can claim this.
                </p>
              </div>
            </div>

            <div>
              <label className="block mb-1.5 text-slate-200 text-[12px]">
                Creator name
              </label>
              <input
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                placeholder="Your public name"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-slate-200 text-[12px]">
                Cover image URL
              </label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                placeholder="Paste image URL (optional)"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                This is the thumbnail shown in feeds and market.
              </p>
            </div>

            <div>
              <label className="block mb-1.5 text-slate-200 text-[12px]">
                Attachment file - any type
              </label>

              <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-950 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-lg">
                    📎
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] text-slate-100">
                      {attachmentFile ? attachmentFile.name : "Choose any file"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      PDFs, images, videos, audio, zip, docs etc
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-violet-500 px-3 py-1 text-[11px] font-semibold text-slate-950">
                  Browse
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    setAttachmentFile(
                      e.target.files && e.target.files[0]
                        ? e.target.files[0]
                        : null
                    )
                  }
                />
              </label>

              <p className="mt-1 text-[11px] text-slate-500">
                This file is the main asset of the drop.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-3 w-full rounded-2xl bg-violet-500 px-4 py-2.5 text-[13px] font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Publishing..." : "Publish drop"}
            </button>

            {msg && (
              <p className="mt-2 text-[12px] text-slate-200">
                {msg}
              </p>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}