// pages/creator-profile-settings.tsx
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../lib/brand";

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function CreatorProfileSettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        router.push("/auth?redirect=/creator-profile-settings");
        return;
      }

      const user = userData.user;

      const { data, error } = await supabase
        .from("creator_profiles")
        .select("id, display_name, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error(error);
        setError("Profile load nahi ho paaya.");
      } else if (data) {
        setProfile(data as Profile);
      } else {
        setProfile({
          id: user.id,
          display_name: user.email || null,
          bio: null,
          avatar_url: null,
        });
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;

    const form = e.currentTarget;
    const display_name = (form.display_name as any).value.trim() || null;
    const bio = (form.bio as any).value.trim() || null;
    const avatar_url = (form.avatar_url as any).value.trim() || null;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from("creator_profiles")
      .upsert(
        {
          id: profile.id,
          display_name,
          bio,
          avatar_url,
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error(error);
      setError("Profile save nahi ho paaya.");
    } else {
      setSuccess("Profile updated.");
    }

    setSaving(false);
  };

  return (
    <div className="px-4 py-3 pb-24 max-w-3xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-800/80 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-300 hover:bg-slate-900 transition"
        >
          ← Back
        </button>

        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            {BRAND.shortCode || BRAND.name}
          </p>
          <h1 className="text-sm font-semibold text-slate-50">
            Profile basics
          </h1>
          <p className="text-[11px] text-slate-400">
            Public name, avatar aur bio update karo.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-2xl border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-3 rounded-2xl border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-100">
          {success}
        </div>
      )}

      {loading || !profile ? (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 space-y-3">
          <div className="h-10 w-10 rounded-full bg-slate-800 animate-pulse" />
          <div className="h-6 w-40 rounded bg-slate-800 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-900 animate-pulse" />
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 space-y-3 text-[11px]"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center text-xs">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>
                  {(profile.display_name || "C").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              High res square image use karo best result ke liye.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300">Display name</label>
            <input
              name="display_name"
              defaultValue={profile.display_name || ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300">Avatar URL</label>
            <input
              name="avatar_url"
              defaultValue={profile.avatar_url || ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-100"
              placeholder="https://image-link.jpg"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300">Bio</label>
            <textarea
              name="bio"
              defaultValue={profile.bio || ""}
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-100"
              placeholder="2–3 lines: who you are, what you create, why people should own your drops."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-violet-600 px-5 py-2 text-[11px] font-semibold text-white shadow shadow-violet-900/60 disabled:opacity-60 hover:bg-violet-500"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}