import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";
type ItemRow = {
  id: string;
  title: string;
  price: number;
  stock: number;
  cover_url: string | null;
  creator_name: string | null;
  creator_id: string | null;
  is_paid?: boolean | null;
  payment_link?: string | null;
  coins_per_claim?: number | null;
};

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);

  // form fields
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [coinsPerClaim, setCoinsPerClaim] = useState("10");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  // load admin user + items
  useEffect(() => {
    async function load() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      const u = authData.user;
      setUser(u);

      const { data, error } = await supabase
        .from("items")
        .select(
          "id, title, price, stock, cover_url, creator_name, creator_id, is_paid, payment_link, coins_per_claim"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setItems([]);
      } else {
        setItems((data || []) as ItemRow[]);
      }

      setLoading(false);
    }

    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setPrice("");
    setStock("");
    setImageUrl("");
    setIsPaid(false);
    setPaymentLink("");
    setCoinsPerClaim("10");
  }

  function handleEdit(item: ItemRow) {
    setEditingId(item.id);
    setTitle(item.title);
    setPrice(String(item.price));
    setStock(String(item.stock));
    setImageUrl(item.cover_url || "");
    setIsPaid(!!item.is_paid);
    setPaymentLink(item.payment_link || "");
    setCoinsPerClaim(
      item.coins_per_claim != null ? String(item.coins_per_claim) : "10"
    );
  }

  async function handleSave() {
    if (!user) return;

    const priceNum = Number(price);
    const stockNum = Number(stock);
    const coinsNum = Number(coinsPerClaim);

    if (!title.trim() || !priceNum || !stockNum) {
      setToast("Please fill all required fields.");
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      price: priceNum,
      stock: stockNum,
      cover_url: imageUrl.trim() || null,
      creator_name: user.email || "Admin",
      creator_id: user.id,
      is_paid: isPaid,
      payment_link: paymentLink.trim() || null,
      coins_per_claim: coinsNum || 10,
    };

    let error: any = null;

    if (editingId) {
      const { error: updateError } = await supabase
        .from("items")
        .update(payload)
        .eq("id", editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("items")
        .insert(payload);
      error = insertError;
    }

    if (error) {
      console.error(error);
      setToast("Error saving item.");
      setSaving(false);
      return;
    }

    setToast("Saved!");
    resetForm();

    const { data } = await supabase
      .from("items")
      .select(
        "id, title, price, stock, cover_url, creator_name, creator_id, is_paid, payment_link, coins_per_claim"
      )
      .order("created_at", { ascending: false });

    setItems((data || []) as ItemRow[]);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;
    await supabase.from("items").delete().eq("id", id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm">Please log in first.</p>
        <a
          href="/auth"
          className="mt-4 px-4 py-2 rounded bg-violet-500 text-slate-950 text-sm"
        >
          Login →
        </a>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-slate-950 text-slate-50 pb-12">
      <main className="mx-auto max-w-5xl p-6">
        {/* top bar */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Admin Panel</h1>
            <p className="mt-1 text-xs text-slate-400">
              Add / edit drops, prices, stock, images & payment links.
            </p>
          </div>
          <a
            href="/"
            className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs text-slate-200"
          >
            Back to home
          </a>
        </header>

        {/* FORM */}
        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4">
            {editingId ? "Edit drop" : "Create new drop"}
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 text-[11px]">
            <div>
              <p className="label-primary">Title</p>
              <input
                className="input-primary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <p className="label-primary">Price (₹)</p>
              <input
                className="input-primary"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>



            <div>
              <p className="label-primary">Stock</p>
              <input
                className="input-primary"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>

            <div>
              <p className="label-primary">Cover image URL</p>
              <input
                className="input-primary"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
              />
              <span className="text-[11px] text-slate-200">
                This is a paid drop (requires Cashfree payment)
              </span>
            </div>

            {isPaid && (
              <div>
                <p className="label-primary">Cashfree payment link</p>
                <input
                  className="input-primary"
                  value={paymentLink}
                  onChange={(e) => setPaymentLink(e.target.value)}
                  placeholder="https://payments.cashfree.com/order#/..."
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Create a Payment Link in your Cashfree dashboard and
                  paste the URL here.
                </p>
              </div>
            )}

            <div>
              <p className="label-primary">Coins per claim</p>
              <input
                className="input-primary"
                type="number"
                value={coinsPerClaim}
                onChange={(e) => setCoinsPerClaim(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Users will earn this many coins when they claim this
                drop.
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-200">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Brand story broadcast</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Yahan se app ke logo pe protocol stories, big announcements aur
                  important updates publish karoge. Ye WhatsApp status nahi hai, sirf
                  high signal cheeze daalna.
                </div>
              </div>
              <Link
                href="/admin/brand-story"
                className="shrink-0 rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950"
              >
                Open editor
              </Link>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save drop"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs"
              >
                Cancel edit
              </button>
            )}
          </div>
        </section>

        {/* ITEMS LIST */}
        <section>
          <h2 className="text-sm mb-3 font-semibold">All drops</h2>

          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-400">No drops yet.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/90 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      ₹{item.price} • Stock {item.stock} •{" "}
                      {item.is_paid ? "Paid" : "Free"} • Coins per
                      claim: {item.coins_per_claim ?? 10}
                    </p>
                    {item.is_paid && item.payment_link && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Cashfree:{" "}
                        <span className="break-all">
                          {item.payment_link}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="px-3 py-1 rounded bg-violet-500 text-slate-950 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-1 rounded bg-red-600 text-slate-50 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center">
          <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500 rounded-xl text-xs text-emerald-300">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}