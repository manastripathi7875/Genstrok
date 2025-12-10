// lib/useBrandStory.ts
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type BrandSettings = {
  logo_url: string | null;
  story_updated_at: string | null;
  story_active: boolean;
};

export function useBrandStory() {
  const [settings, setSettings] = useState<BrandSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("brand_settings")
          .select("*")
          .limit(1)
          .single();

        if (!error && data) {
          const s = data as any;
          const settingsVal: BrandSettings = {
            logo_url: s.logo_url,
            story_updated_at: s.story_updated_at,
            story_active: s.story_active,
          };
          setSettings(settingsVal);

          if (s.story_active && s.story_updated_at) {
            const seen = localStorage.getItem("brandStorySeenAt");
            if (!seen || new Date(seen) < new Date(s.story_updated_at)) {
              setHasUnread(true);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const markSeen = () => {
    if (!settings?.story_updated_at) return;
    localStorage.setItem("brandStorySeenAt", settings.story_updated_at);
    setHasUnread(false);
  };

  return { settings, loading, hasUnread, markSeen };
}