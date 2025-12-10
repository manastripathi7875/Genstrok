// pages/admin/brand-story.tsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type AdminStory = {
  id: string;
  title: string;
  media_url: string | null;
  starts_at: string;
  expires_at: string;
};

export default function BrandStoryAdminPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [importance, setImportance] = useState<"normal" | "critical">("normal");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [activeStories, setActiveStories] = useState<AdminStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files));
  };

  const loadActiveStories = async () => {
    setLoadingStories(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("brand_stories")
      .select("id,title,media_url,starts_at,expires_at")
      .lte("starts_at", nowIso)
      .gte("expires_at", nowIso)
      .order("starts_at", { ascending: true });

    if (!error && data) setActiveStories(data as any);
    else setActiveStories([]);
    setLoadingStories(false);
  };

  useEffect(() => {
    loadActiveStories();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      setStatus("Title daal pehle.");
      return;
    }

    if (files.length === 0) {
      setStatus("Kam se kam ek image ya video select karo.");
      return;
    }

    setSaving(true);
    setStatus("Uploading media and creating stories...");

    try {
      const startsAt = new Date();
      const expiresAt = new Date(
        startsAt.getTime() + durationHours * 60 * 60 * 1000
      );

      const storyRows: any[] = [];

      for (const file of files) {
        const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
        const path = `brand-stories/${startsAt.getTime()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("brand_assets")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error(uploadError);
          setStatus(`Upload failed for ${file.name}`);
          setSaving(false);
          return;
        }

        const { data: publicData } = supabase.storage
          .from("brand_assets")
          .getPublicUrl(path);

        const mediaUrl = publicData?.publicUrl;
        if (!mediaUrl) {
          setStatus("Could not get public URL for media.");
          setSaving(false);
          return;
        }

        storyRows.push({
          title,
          body: body || null,
          media_url: mediaUrl,
          cta_text: ctaText || null,
          cta_url: ctaUrl || null,
          importance,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }

      const { error: storyError } = await supabase
        .from("brand_stories")
        .insert(storyRows);

      if (storyError) {
        console.error(storyError);
        setStatus("Story rows insert fail. Console check karo.");
        setSaving(false);
        return;
      }

      // brand_settings update with filter
      const { data: existingSettings, error: fetchErr } = await supabase
        .from("brand_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      const nowIso = new Date().toISOString();

      if (fetchErr) {
        console.error(fetchErr);
      } else if (existingSettings?.id) {
        await supabase
          .from("brand_settings")
          .update({
            story_active: true,
            story_updated_at: nowIso,
          })
          .eq("id", existingSettings.id);
      } else {
        await supabase.from("brand_settings").insert({
          story_active: true,
          story_updated_at: nowIso,
        });
      }

      setStatus(
        `Published ${storyRows.length} story item(s). Logo ring ab active hai.`
      );
      setTitle("");
      setBody("");
      setCtaText("");
      setCtaUrl("");
      setFiles([]);

      loadActiveStories();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStory = async (id: string) => {
    setStatus("Deleting story...");
    await supabase.from("brand_stories").delete().eq("id", id);
    await loadActiveStories();

    // agar koi active story nahi bachi to brand_settings off
    if (activeStories.length <= 1) {
      const nowIso = new Date().toISOString();
      const { data: existingSettings } = await supabase
        .from("brand_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existingSettings?.id) {
        await supabase
          .from("brand_settings")
          .update({
            story_active: false,
            story_updated_at: nowIso,
          })
          .eq("id", existingSettings.id);
      }
    }

    setStatus("Story deleted.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Brand story admin</h1>
          <p className="text-xs text-slate-400 mt-1">
            Ye WhatsApp status nahi hai. Sirf high signal protocol updates,
            payouts, major feature releases yaha post karo. Har media ek alag
            story slide banega.
          </p>
        </div>

        {/* create form */}
        <div className="space-y-3 text-xs rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div>
            <label className="block mb-1 text-slate-300">Title</label>
            <input
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: New claim reward model live"
            />
          </div>

          <div>
            <label className="block mb-1 text-slate-300">Body</label>
            <textarea
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs h-24"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Short explainer, max 3 to 4 lines."
            />
          </div>

          <div>
            <label className="block mb-1 text-slate-300">
              Media files (images or videos)
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="w-full text-[11px] text-slate-300"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Saare selected files sequence me stories banenge. Tap se next
              slide jayega.
            </p>
            {files.length > 0 && (
              <p className="mt-1 text-[10px] text-slate-300">
                Selected: {files.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block mb-1 text-slate-300">CTA text</label>
              <input
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Open wallet, View new drop, etc"
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1 text-slate-300">CTA URL</label>
              <input
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="/wallet, /create-drop or full https link"
              />
            </div>
          </div>

          <div className="flex gap-2 items-end">
            <div>
              <label className="block mb-1 text-slate-300">
                Duration (hours)
              </label>
              <input
                type="number"
                min={1}
                max={72}
                className="w-24 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block mb-1 text-slate-300">Importance</label>
              <select
                className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
                value={importance}
                onChange={(e) =>
                  setImportance(e.target.value as "normal" | "critical")
                }
              >
                <option value="normal">Normal</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving}
            className={
              "mt-2 rounded-full px-4 py-2 text-xs font-semibold " +
              (saving
                ? "bg-slate-800 text-slate-400"
                : "bg-violet-500 text-slate-950")
            }
          >
            {saving ? "Publishing..." : "Publish story batch"}
          </button>
        </div>

        {/* active stories list */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Active stories</span>
            {loadingStories && (
              <span className="text-[10px] text-slate-400">Refreshing...</span>
            )}
          </div>

          {activeStories.length === 0 && (
            <p className="text-[11px] text-slate-400">
              Abhi koi active story nahi hai.
            </p>
          )}

          <div className="space-y-2">
            {activeStories.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2"
              >
                {s.media_url && (
                  <div className="h-10 w-10 rounded-lg overflow-hidden bg-black shrink-0">
                    <img
                      src={s.media_url}
                      alt={s.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-[11px] font-medium line-clamp-1">
                    {s.title}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Active till {new Date(s.expires_at).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteStory(s.id)}
                  className="text-[10px] px-2 py-1 rounded-full bg-rose-500/90 text-slate-950"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        {status && (
          <p className="text-[11px] text-slate-300 whitespace-pre-line">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}