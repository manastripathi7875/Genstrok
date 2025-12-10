// components/BrandStoryModal.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Story = {
  id: string;
  title: string;
  body: string | null;
  media_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
};

export function BrandStoryModal({ onClose }: { onClose: () => void }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    async function loadStories() {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("brand_stories")
        .select("*")
        .lte("starts_at", nowIso)
        .gte("expires_at", nowIso)
        .order("starts_at", { ascending: true }); // oldest first

      if (!error && data) setStories(data as any);
      else setStories([]);
    }
    loadStories();
  }, []);

  const current = stories[index];

  if (!current) {
    return null;
  }

  const handleNext = () => {
    if (index < stories.length - 1) setIndex(index + 1);
    else onClose();
  };

  const handlePrev = () => {
    if (index > 0) setIndex(index - 1);
    else onClose();
  };

  const isVideo =
    current.media_url &&
    /\.(mp4|webm|ogg|mov|m4v)$/i.test(current.media_url.split("?")[0]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col">
        {/* top controls */}
        <div className="pt-4 px-4">
          <div className="flex gap-1 mb-3">
            {stories.map((s, i) => (
              <div
                key={s.id}
                className={
                  "h-1 flex-1 rounded-full " +
                  (i <= index ? "bg-violet-400" : "bg-slate-700")
                }
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              className="h-8 w-8 rounded-full bg-black/50 text-xs text-slate-100 flex items-center justify-center"
            >
              ←
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-black/50 text-xs text-slate-100 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* media full height */}
        <div
          className="flex-1 mt-2 px-4 pb-6 flex items-center justify-center"
          onClick={handleNext}
        >
          <div className="w-full h-full rounded-3xl overflow-hidden bg-black">
            {current.media_url && (
              <>
                {isVideo ? (
                  <video
                    src={current.media_url}
                    className="h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={current.media_url}
                    alt={current.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* text overlay bottom */}
        <div className="absolute left-0 right-0 bottom-0 px-5 pb-6 pointer-events-none">
          <div className="rounded-2xl bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
            <div className="text-sm font-semibold text-slate-50">
              {current.title}
            </div>
            {current.body && (
              <p className="text-[11px] text-slate-200 mt-1 whitespace-pre-line">
                {current.body}
              </p>
            )}

            {current.cta_url && current.cta_text && (
              <a
                href={current.cta_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-medium text-slate-950 mt-2 pointer-events-auto"
              >
                {current.cta_text}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}