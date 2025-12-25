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

  // NEW: cover thumbnail file
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  // Main locked attachment
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // NEW: description images
  const [descriptionFiles, setDescriptionFiles] = useState<File[]>([]);
  const [descriptionPreviewUrls, setDescriptionPreviewUrls] = useState<string[]>(
    []
  );

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

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setCoverFile(file || null);
    if (file) {
      const url = URL.createObjectURL(file);
      setCoverPreviewUrl(url);
    } else {
      setCoverPreviewUrl(null);
    }
  }

  function handleDescriptionImagesChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setDescriptionFiles(files);
    setDescriptionPreviewUrls(files.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!user) {
      setNeedsLogin(true);
      setMsg("You need to login first.");
      return;
    }

    const numericPrice = Number(price || "0");
    const numericStock = Number(stock || "0");
    const coinsPerClaim = 10; // hidden default

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setMsg("Price must be a valid number ≥ 0.");
      return;
    }

    if (Number.isNaN(numericStock) || numericStock < 1) {
      setMsg("Stock must be at least 1.");
      return;
    }

    const isPaid = numericPrice > 0;

    setSaving(true);
    setMsg("Creating drop...");

    let coverUrl: string | null = null;
    let attachmentPath: string | null = null;
    let attachmentOriginalName: string | null = null;
    let attachmentMimeType: string | null = null;
    let descriptionImageUrls: string[] = [];

    try {
      // 1) Upload cover thumbnail (image/video)
      if (coverFile) {
        const bucketName = "item-covers";
        const fileExt = coverFile.name.split(".").pop() || "bin";
        const filePath = `${user.id}/cover-${Date.now()}.${fileExt}`;

        const { error: coverErr } = await supabase.storage
          .from(bucketName)
          .upload(filePath, coverFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (coverErr) {
          console.error("Cover upload error", coverErr);
          throw coverErr;
        }

        const { data } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        coverUrl = data?.publicUrl || null;
      }

      // 2) Upload locked main attachment file
      if (attachmentFile) {
        const bucketName = "item-files";
        const fileExt = attachmentFile.name.split(".").pop() || "bin";
        const filePath = `${user.id}/asset-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, attachmentFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Attachment upload error", uploadError);
          throw uploadError;
        }

        attachmentPath = filePath;
        attachmentOriginalName = attachmentFile.name;
        attachmentMimeType = attachmentFile.type || null;
      }

      // 3) Upload description images (optional, can be multiple)
      if (descriptionFiles.length > 0) {
        const bucketName = "item-description-images";
        const urls: string[] = [];

        for (const file of descriptionFiles) {
          const fileExt = file.name.split(".").pop() || "bin";
          const filePath = `${user.id}/desc-${Date.now()}-${file.name.replace(
            /\s+/g,
            "-"
          )}.${fileExt}`;

          const { error: imgErr } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (imgErr) {
            console.error("Description image upload error", imgErr);
            throw imgErr;
          }

          const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

          if (data?.publicUrl) {
            urls.push(data.publicUrl);
          }
        }

        descriptionImageUrls = urls;
      }

      // 4) Insert row into items
      const { data, error } = await supabase
        .from("items")
        .insert([
          {
            title: title.trim(),
            description: description.trim() || null,
            price: numericPrice,
            stock: numericStock,
            remaining: numericStock,
            cover_url: coverUrl,
            creator_name: creatorName.trim() || null,
            user_id: user.id,
creator_id: user.id,
            is_paid: isPaid,
            coins_per_claim: coinsPerClaim,
            is_published: true,

            attachment_path: attachmentPath,
            attachment_original_name: attachmentOriginalName,
            attachment_mime_type: attachmentMimeType,

            description_images: descriptionImageUrls,
          },
        ])
        
        .select()
        .single();
      await supabase.from("activity_feed").insert({
        actor_id: user.id,
        actor_name: user.user_metadata?.name || user.email,
        actor_avatar: user.user_metadata?.avatar_url || null,
        action_type: "drop_created",
        target_type: "drop",
        target_id: data?.[0]?.id,
        meta: {
          title: title,
          price: price,
        },
      });

      if (error) {
        console.error("Insert error", error);
        throw error;
      }

      setMsg("Drop created successfully ✅");

      // reset form
      setTitle("");
      setDescription("");
      setPrice("0");
      setStock("1");
      setCreatorName(
        user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          creatorName
      );
      setCoverFile(null);
      setCoverPreviewUrl(null);
      setAttachmentFile(null);
      setDescriptionFiles([]);
      setDescriptionPreviewUrls([]);

      // redirect to detail page
      if (data?.id && typeof window !== "undefined") {
        setTimeout(() => {
          window.location.href = `/drop/${data.id}`;
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setMsg("Error creating drop: " + (err?.message || "Unknown error"));
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
    <div className="min-h-screen bg-[#020617] text-slate-50 pb-10">
      {/* soft gradient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
        {/* header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <a
            href="/"
            className="rounded-full border border-slate-800 bg-black/40 px-4 py-2 text-[12px] text-slate-200 flex items-center gap-2"
          >
            <span>←</span>
            <span>Back to market</span>
          </a>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
              New drop
            </p>
            <h1 className="text-base sm:text-lg font-semibold">
              Create a {BRAND.name} drop
            </h1>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/90 shadow-[0_18px_60px_rgba(0,0,0,0.75)] p-5 sm:p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5 text-[12px]">
            {/* Title */}
            <div className="space-y-1">
              <label className="block text-slate-200 text-[12px]">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                placeholder="Example: Real life problem solving research paper"
                required
              />
              <p className="text-[11px] text-slate-500">
                This is the main name of your drop.
              </p>
            </div>

            {/* Description + images */}
            <div className="space-y-2">
              <label className="block text-slate-200 text-[12px]">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70 resize-none"
                placeholder="Story, utility, rewards or instructions for supporters..."
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">
                  Free text. You can also attach images below.
                </p>

                <label className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] cursor-pointer">
                  <span>🖼</span>
                  <span>Add images</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleDescriptionImagesChange}
                  />
                </label>
              </div>

              {descriptionPreviewUrls.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {descriptionPreviewUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="h-16 w-16 rounded-xl overflow-hidden border border-slate-700 flex-shrink-0"
                    >
                      <img
                        src={url}
                        alt={`desc-${idx}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Price + stock */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-slate-200 text-[12px]">
                  Price (₹)
                </label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-[13px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  0 for free drops. Above 0 becomes paid.
                </p>
              </div>

              <div>
                <label className="block mb-1 text-slate-200 text-[12px]">
                  Stock
                </label>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  type="number"
                  min="1"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-[13px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  How many people can claim.
                </p>
              </div>

              <div className="sm:col-span-1 col-span-2">
                <label className="block mb-1 text-slate-200 text-[12px]">
                  Creator name
                </label>
                <input
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                  placeholder="Your public name"
                />
              </div>
            </div>

            {/* Cover thumbnail */}
            <div className="space-y-2">
              <label className="block text-slate-200 text-[12px]">
                Cover thumbnail (image or video)
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex-1 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-3 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-lg">
                      🎞
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] text-slate-100">
                        {coverFile
                          ? coverFile.name
                          : "Select cover from gallery"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Shown on homepage and feeds.
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-500 px-3 py-1 text-[11px] font-semibold text-slate-950">
                    Browse
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleCoverChange}
                  />
                </label>

                {coverPreviewUrl && (
                  <div className="h-20 w-20 rounded-2xl overflow-hidden border border-slate-700 flex-shrink-0 self-center sm:self-auto">
                    <img
                      src={coverPreviewUrl}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Main attachment */}
            <div className="space-y-2">
              <label className="block text-slate-200 text-[12px]">
                Attachment file (locked)
              </label>
              <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-lg">
                    📎
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] text-slate-100">
                      {attachmentFile
                        ? attachmentFile.name
                        : "Choose any file (PDF, image, video, zip, etc)"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      This will be locked and only claimers can access it.
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
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-[13px] font-semibold text-slate-50 hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_12px_35px_rgba(139,92,246,0.55)]"
            >
              {saving ? "Publishing…" : "Publish drop"}
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