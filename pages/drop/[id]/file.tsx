// pages/drop/[id]/file.tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { BRAND } from "../../../lib/brand";

type DropItem = {
  id: number;
  title: string;
  attachment_path: string | null;
  attachment_original_name: string | null;
  attachment_mime_type: string | null;
};

export default function DropFilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<DropItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // bucket name used for attachments
  const BUCKET_NAME = "item-files"; // change only if you used a different bucket name

  useEffect(() => {
    async function init() {
      setErrorMsg(null);
      setLoading(true);

      // 1. get auth user
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        setUser(null);
        setAuthorized(false);
        setLoading(false);
        setErrorMsg("You need to login and claim this drop to view the files.");
        return;
      }
      setUser(userData.user);

      if (!id) {
        setLoading(false);
        setErrorMsg("Drop id is missing.");
        return;
      }

      // 2. check ownership
      const { data: owns, error: ownErr } = await supabase
        .from("ownerships")
        .select("id")
        .eq("item_id", id)
        .eq("buyer_id", userData.user.id)
        .limit(1);

      if (ownErr) {
        console.error("ownership check error", ownErr);
        setAuthorized(false);
        setErrorMsg("Could not verify ownership.");
        setLoading(false);
        return;
      }

      if (!owns || owns.length === 0) {
        setAuthorized(false);
        setErrorMsg(
          "You have not claimed this drop yet. Claim the drop first to unlock the file."
        );
        setLoading(false);
        return;
      }

      setAuthorized(true);

      // 3. load item with attachment fields
      const { data: itemRow, error: itemErr } = await supabase
        .from("items")
        .select(
          "id, title, attachment_path, attachment_original_name, attachment_mime_type"
        )
        .eq("id", id)
        .maybeSingle();

      if (itemErr) {
        console.error("item load error", itemErr);
        setItem(null);
        setErrorMsg("Could not load this drop file.");
        setLoading(false);
        return;
      }

      if (!itemRow || !itemRow.attachment_path) {
        setItem(null);
        setErrorMsg("This drop has no file attached.");
        setLoading(false);
        return;
      }

      setItem(itemRow as DropItem);

      // 4. signed url
      const { data: urlData, error: urlErr } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(itemRow.attachment_path, 60 * 60); // 1 hour

      if (urlErr || !urlData?.signedUrl) {
        console.error("signed url error", urlErr);
        setSignedUrl(null);
        setErrorMsg("Could not generate secure download link.");
        setLoading(false);
        return;
      }

      // add download=1 so browser treats it as download instead of just text
      const base = urlData.signedUrl;
      const withDownload = base.includes("?")
        ? `${base}&download=1`
        : `${base}?download=1`;

      setSignedUrl(withDownload);
      setLoading(false);
    }

    init();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050816] text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">Loading file…</p>
      </div>
    );
  }

  if (!authorized || !item || !signedUrl) {
    return (
      <div className="min-h-screen bg-[#050816] text-slate-50 flex flex-col items-center justify-center p-6">
        <p className="text-lg font-semibold mb-2">File locked</p>
        <p className="text-sm text-slate-400 mb-4 text-center max-w-xs">
          {errorMsg ||
            "You must claim this drop with your account before you can access its files."}
        </p>
        <a
          href={`/drop/${id}`}
          className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400"
        >
          Back to drop →
        </a>
      </div>
    );
  }

  const niceName =
    item.attachment_original_name || `Drop-${item.id}-file.${(item.attachment_mime_type || "").split("/")[1] || "bin"}`;

  return (
    <div className="min-h-screen bg-[#050816] text-slate-50 pb-10">
      {/* header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-[#050816]/95 backdrop-blur border-b border-slate-900">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-lg"
        >
          ←
        </button>
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Drop file
          </span>
          <span className="text-sm font-semibold truncate max-w-[200px]">
            {item.title}
          </span>
        </div>
      </header>

      <main className="relative mx-auto max-w-md px-4 pt-4 pb-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 shadow-xl shadow-black/60 p-4 space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Attached file</p>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold truncate">{niceName}</p>
                <span className="text-[10px] text-slate-500">
                  {item.attachment_mime_type || "Unknown type"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                You claimed this drop. File is unlocked for you.
              </p>
            </div>
          </div>

          <div className="space-y-2 text-[12px]">
            <a
              href={signedUrl}
              className="inline-flex w-full items-center justify-center rounded-full bg-violet-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-violet-400"
            >
              Download / open file
            </a>
            <p className="text-[11px] text-slate-500">
              Your browser will either download the file or open it in a new
              tab, depending on the file type and your device.
            </p>
          </div>

          <a
            href={`/drop/${item.id}`}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] text-slate-200"
          >
            Back to drop detail
          </a>

          <p className="text-[10px] text-slate-500">
            Built on {BRAND.name}. Download is protected by your ownership
            record.
          </p>
        </section>
      </main>
    </div>
  );
}