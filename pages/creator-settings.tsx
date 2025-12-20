// pages/creator-settings.tsx
import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import ThemeToggle from "../components/ThemeToggle"; // if you used the theme code I gave
import { useTheme } from "../components/ThemeProvider"; // optional usage

type Profile = {
  id: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  payout_upi?: string | null;
  payout_note?: string | null;
};

export default function CreatorSettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme ? useTheme() : { theme: "system", setTheme: (t: any) => {} };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // local form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [payoutUpi, setPayoutUpi] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  // notification and advanced toggles (client-side toggles saved to creator_profiles table as JSON in `settings` column OR to UI only)
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [showOwnedDrops, setShowOwnedDrops] = useState(true);
  const [experimental, setExperimental] = useState(false);

  useEffect(() => {
    loadUserAndProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadUserAndProfile() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setCurrentUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      const user = data.user;
      setCurrentUser(user);

      // try fetch profile from creator_profiles by id=user.id
      const { data: pData, error: pError } = await supabase
        .from("creator_profiles")
        .select("id, display_name, bio, avatar_url, payout_upi, payout_note, settings")
        .eq("id", user.id)
        .maybeSingle();

      if (pError) {
        console.error("profile fetch error", pError);
      } else if (pData) {
        setProfile(pData as any);
        setDisplayName(pData.display_name || "");
        setBio(pData.bio || "");
        setAvatarUrl(pData.avatar_url || "");
        setPayoutUpi(pData.payout_upi || "");
        setPayoutNote(pData.payout_note || "");

        // populate toggles from settings if present
        try {
          const s = (pData as any).settings;
          if (s) {
            setEmailUpdates(!!s.emailUpdates);
            setInAppAlerts(!!s.inAppAlerts);
            setShowOwnedDrops(!!s.showOwnedDrops);
            setExperimental(!!s.experimental);
          }
        } catch (e) {
          /* ignore */
        }
      } else {
        // no profile row
        setProfile(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e?: any) {
    if (!currentUser) return router.push("/auth");
    setSaving(true);
    try {
      const payload: any = {
        id: currentUser.id,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        payout_upi: payoutUpi.trim() || null,
        payout_note: payoutNote.trim() || null,
        settings: {
          emailUpdates,
          inAppAlerts,
          showOwnedDrops,
          experimental,
        },
      };

      const { error } = await supabase.from("creator_profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      setToast("Settings saved");
      await loadUserAndProfile();
    } catch (err: any) {
      console.error(err);
      setToast("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setToast("Logged out");
      router.push("/");
    } catch (err) {
      console.error(err);
      setToast("Logout failed");
    }
  }

  // 1) Request account deletion (creates request row) -> Admin will process
  async function requestAccountDeletion() {
    if (!currentUser) return router.push("/auth");
    const ok = confirm("Request account deletion? This will notify admins. This is irreversible after admin completes deletion.");
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id, reason: "User requested deletion from settings" }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || res.statusText);
      }
      setToast("Delete request submitted");
    } catch (err: any) {
      console.error(err);
      setToast("Request failed");
    } finally {
      setSaving(false);
    }
  }

  // 2) Immediate client-side account deletion is dangerous. We do not perform service-role deletes from client.
  //    If you want direct delete, I will add a server API /api/account/delete (service role required).
  //    For now keep manual admin approval workflow.

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
        <div className="text-sm opacity-80">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-12">
      <Head>
        <title>Creator settings — Genstrok</title>
      </Head>

      <main className="mx-auto max-w-4xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Creator settings</h1>
            <p className="mt-1 text-sm text-slate-400">Tune your Genstrok creator account</p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl gs-btn text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Profile basics card */}
        <section className="mb-5 gs-card p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-xl">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-semibold">{(profile?.display_name || (currentUser?.email || "U")).charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-lg font-semibold">{profile?.display_name || currentUser?.email || "Creator"}</div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-2">{profile?.bio || "This is your public creator intro"}</div>
                </div>

                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => router.push("/creator-profile-settings")}
                    className="px-3 py-2 rounded-xl bg-violet-500 text-slate-950 text-sm font-semibold"
                  >
                    Edit profile basic
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300">Display name</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-primary mt-1" placeholder="Your public name" />
                </div>

                <div>
                  <label className="text-xs text-slate-300">Avatar URL</label>
                  <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="input-primary mt-1" placeholder="https://..." />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-300">Short bio</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="input-primary mt-1" placeholder="What you create, what drops you publish..." />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Payout settings */}
        <section className="mb-5 gs-card p-5">
          <h3 className="text-sm font-semibold mb-3">Payout settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300">UPI ID for payouts</label>
              <input value={payoutUpi} onChange={(e) => setPayoutUpi(e.target.value)} className="input-primary mt-1" placeholder="yourupi@bank" />
            </div>
            <div>
              <label className="text-xs text-slate-300">Payout note / instructions</label>
              <input value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} className="input-primary mt-1" placeholder="Monthly payout, minimum 500 rupees, etc." />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">This info is visible only to Genstrok internal tools and payouts team. Not public.</p>
        </section>

        {/* Notifications */}
        <section className="mb-5 gs-card p-5">
          <h3 className="text-sm font-semibold mb-3">Notification preferences</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Email updates</div>
                <div className="text-xs text-slate-400">New claims, big drops performance, payout reminders.</div>
              </div>
              <label className="inline-flex relative items-center cursor-pointer">
                <input type="checkbox" checked={emailUpdates} onChange={(e) => setEmailUpdates(e.target.checked)} className="sr-only" />
                <div className={`w-12 h-6 rounded-full transition ${emailUpdates ? "bg-emerald-500" : "bg-slate-700"}`} />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">In-app alerts</div>
                <div className="text-xs text-slate-400">Push-style banners / badges for important events.</div>
              </div>
              <label className="inline-flex relative items-center cursor-pointer">
                <input type="checkbox" checked={inAppAlerts} onChange={(e) => setInAppAlerts(e.target.checked)} className="sr-only" />
                <div className={`w-12 h-6 rounded-full transition ${inAppAlerts ? "bg-emerald-500" : "bg-slate-700"}`} />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Show owned drops & stats on profile</div>
                <div className="text-xs text-slate-400">Control whether live drops and coins overview show on your public profile.</div>
              </div>
              <label className="inline-flex relative items-center cursor-pointer">
                <input type="checkbox" checked={showOwnedDrops} onChange={(e) => setShowOwnedDrops(e.target.checked)} className="sr-only" />
                <div className={`w-12 h-6 rounded-full ${showOwnedDrops ? "bg-emerald-500" : "bg-slate-700"}`} />
              </label>
            </div>
          </div>
        </section>

        {/* Advanced & experimental */}
        <section className="mb-6 gs-card p-5">
          <h3 className="text-sm font-semibold mb-3">Advanced & experimental</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Experimental features</div>
                <div className="text-xs text-slate-400">Early Protera/Genstrok engine features. Use at your own risk.</div>
              </div>
              <label className="inline-flex relative items-center cursor-pointer">
                <input type="checkbox" checked={experimental} onChange={(e) => setExperimental(e.target.checked)} className="sr-only" />
                <div className={`w-12 h-6 rounded-full ${experimental ? "bg-violet-500" : "bg-slate-700"}`} />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSaveProfile} disabled={saving} className="gs-btn px-5 py-2 text-sm">
                {saving ? "Saving…" : "Save all settings"}
              </button>

              <button onClick={() => { setDisplayName(""); setBio(""); setAvatarUrl(""); setPayoutUpi(""); setPayoutNote(""); setEmailUpdates(true); setInAppAlerts(true); setShowOwnedDrops(true); setExperimental(false); setToast("Reset local form") }} className="px-4 py-2 rounded-xl bg-slate-800 text-sm">
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* Account actions */}
        <section className="gs-card p-5">
          <h3 className="text-sm font-semibold mb-3">Account actions</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Request account deletion</div>
                <div className="text-xs text-slate-400">This will create a deletion request for admins to process. After admin marks completed, account will be removed.</div>
              </div>
              <button onClick={requestAccountDeletion} disabled={saving} className="px-4 py-2 rounded-xl bg-rose-600 text-slate-50 text-sm">
                Request deletion
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Theme</div>
                <div className="text-xs text-slate-400">Switch between Light or Dark UI for your device.</div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => setTheme && setTheme("light")} className="px-4 py-2 rounded-xl bg-white/10 text-sm">Light</button>
                <button onClick={() => setTheme && setTheme("dark")} className="px-4 py-2 rounded-xl bg-slate-800 text-sm">Dark</button>
                <button onClick={() => setTheme && setTheme("system")} className="px-4 py-2 rounded-xl bg-slate-700 text-sm">System</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
          <div className="rounded-xl px-4 py-2 bg-slate-800/80 text-sm">{toast}</div>
        </div>
      )}
    </div>
  );
}