// pages/drop/[id].tsx

import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { BRAND } from "../../lib/brand";

type ItemRow = {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  stock: number;
  cover_url?: string | null;
  coins_per_claim?: number | null;
  views?: number | null;
  likes?: number | null;
  claims?: number | null;
  creator_id?: string | null;
  creator_name?: string | null;
  description_images?: string[] | null;
};

type WalletRow = {
  user_id: string;
  balance: number;
};

type OwnershipRow = {
  id: string;
  buyer_id: string;
  item_id: number;
  coins: number | null;
  claims_count?: number | null;
};

export default function DropDetailPage() {
  const router = useRouter();
  const rawId = router.query.id;

  const dropId = useMemo(() => {
    if (!rawId) return null;
    const n = Number(rawId);
    return Number.isNaN(n) ? null : n;
  }, [rawId]);

  const [item, setItem] = useState<ItemRow | null>(null);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [ownership, setOwnership] = useState<OwnershipRow | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);

  // new: like / share / comments UI state
  const [likesCount, setLikesCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false); // simple toggle, no per-user table
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [localComments, setLocalComments] = useState<
    { id: number; text: string }[]
  >([]);
  const commentsRef = useRef<HTMLDivElement | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  // 1) current user
  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error(error);
        return;
      }
      if (data?.user) setCurrentUser(data.user);
      else setCurrentUser(null);
    }
    loadUser();
  }, []);

  // 2) drop + wallet + ownership + cart
  useEffect(() => {
    if (!dropId) return;

    async function loadAll() {
      setLoading(true);

      try {
        // item
        const { data: itemData, error: itemError } = await supabase
          .from("items")
          .select("*")
          .eq("id", dropId)
          .maybeSingle();

        if (itemError) {
          console.error("Item load error", itemError);
        }

        if (!itemData) {
          setItem(null);
          setWallet(null);
          setOwnership(null);
          setCartCount(0);
          setLoading(false);
          return;
        }

        const typedItem = itemData as ItemRow;
        setItem(typedItem);
        setLikesCount(typedItem.likes ?? 0);
        setLiked(false); // koi proper like-table nahi hai, simple toggle

        if (!currentUser) {
          setWallet(null);
          setOwnership(null);
          setCartCount(0);
          setLoading(false);
          return;
        }

        const userId = currentUser.id;

        // wallet
        const { data: walletData, error: walletError } = await supabase
          .from("wallets")
          .select("user_id, balance")
          .eq("user_id", userId)
          .maybeSingle();

        if (walletError && walletError.code !== "PGRST116") {
          console.error("Wallet error", walletError);
        }
        setWallet(walletData as WalletRow | null);

        // ownership – old schema: buyer_id
        const { data: ownData, error: ownError } = await supabase
          .from("ownerships")
          .select("id, buyer_id, item_id, coins, claims_count")
          .eq("buyer_id", userId)
          .eq("item_id", dropId)
          .maybeSingle();

        if (ownError && ownError.code !== "PGRST116") {
          console.error("Ownership error", ownError);
        }
        setOwnership(ownData as OwnershipRow | null);

        // cart count
        const { data: cartData, error: cartError } = await supabase
          .from("cart")
          .select("id")
          .eq("user_id", userId)
          .eq("is_checked_out", false);

        if (cartError) {
          console.error("Cart error", cartError);
          setCartCount(0);
        } else {
          setCartCount((cartData || []).length);
        }
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [dropId, currentUser]);

  const isFree = item?.price === 0;
  const isOutOfStock = !item || !item.stock || item.stock <= 0;
  const hasClaim = !!ownership;

  const canAddToCart = !!item && item.price > 0 && !isOutOfStock;
  const canClaimNow = !!item && !isOutOfStock;

  // 3) add to cart
  async function handleAddToCart() {
    if (!item || !canAddToCart) return;

    if (!currentUser) {
      router.push("/auth");
      return;
    }

    setAddingToCart(true);
    try {
      const userId = currentUser.id;

      const { error: insertError } = await supabase.from("cart").insert({
        user_id: userId,
        item_id: item.id,
        price: item.price,
        is_checked_out: false,
      });

      if (insertError) {
        console.error(insertError);
        showToast("Could not add to cart");
        return;
      }

      const { data: cartData, error: cartError } = await supabase
        .from("cart")
        .select("id")
        .eq("user_id", userId)
        .eq("is_checked_out", false);

      if (!cartError) {
        setCartCount((cartData || []).length);
      }

      showToast("Added to cart");
    } finally {
      setAddingToCart(false);
    }
  }

  // 4) buy + claim – old ownership schema
  async function handleBuyAndClaim() {
    if (!item || !canClaimNow) return;

    if (!currentUser) {
      router.push("/auth");
      return;
    }

    setClaiming(true);
    try {
      const userId = currentUser.id;
      const price = item.price || 0;
      let currentBalance = wallet?.balance ?? 0;

      // ensure wallet exists
      if (!wallet) {
        const { data: created, error: createErr } = await supabase
          .from("wallets")
          .insert({ user_id: userId, balance: 0 })
          .select("user_id, balance")
          .maybeSingle();

        if (createErr) {
          console.error("Wallet create error", createErr);
          showToast("Wallet error");
          return;
        }
        currentBalance = (created as any)?.balance ?? 0;
        setWallet(created as WalletRow);
      }

      // paid drop
      if (price > 0) {
        if (currentBalance < price) {
          showToast("Not enough wallet balance");
          return;
        }

        const newBalance = currentBalance - price;
        const { error: updErr } = await supabase
          .from("wallets")
          .update({ balance: newBalance })
          .eq("user_id", userId);

        if (updErr) {
          console.error("Wallet update error", updErr);
          showToast("Wallet update failed");
          return;
        }

        setWallet({ user_id: userId, balance: newBalance });
      }

      // insert ownership with buyer_id
      const coins = item.coins_per_claim ?? 0;
      const buyerName =
        currentUser.user_metadata?.full_name ||
        currentUser.email ||
        userId;

      const { error: ownErr } = await supabase.from("ownerships").insert({
        item_id: item.id,
        buyer_id: userId,
        buyer_name: buyerName,
        coins,
      });

      if (ownErr) {
        console.error("Ownership insert error", ownErr);
        showToast("Could not claim this drop");
        return;
      }

      // update stock
      const newStock = (item.stock ?? 0) - 1;
      if (newStock >= 0) {
        const { error: stockErr } = await supabase
          .from("items")
          .update({ stock: newStock })
          .eq("id", item.id);

        if (stockErr) {
          console.error("Stock update error", stockErr);
        } else {
          setItem({ ...item, stock: newStock });
        }
      }

      // reload ownership
      const { data: ownRow } = await supabase
        .from("ownerships")
        .select("id, buyer_id, item_id, coins, claims_count")
        .eq("buyer_id", userId)
        .eq("item_id", item.id)
        .maybeSingle();

      if (ownRow) setOwnership(ownRow as OwnershipRow);

      showToast(
        price > 0
          ? `Bought and claimed +${coins} ${BRAND.coinName}`
          : `Claimed +${coins} ${BRAND.coinName}`
      );

      router.push(`/drop/${item.id}/file`);
    } finally {
      setClaiming(false);
    }
  }

  function handleOpenFile() {
    if (!item) return;
    router.push(`/drop/${item.id}/file`);
  }

  // 5) LIKE toggle – super simple
  async function handleToggleLike() {
    if (!item) return;
    if (!currentUser) {
      router.push("/auth");
      return;
    }

    const nextLiked = !liked;
    const nextCount = likesCount + (nextLiked ? 1 : -1 < 0 ? 0 : 1);
    const safeNextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1));

    setLiked(nextLiked);
    setLikesCount(safeNextCount);

    const { error } = await supabase
      .from("items")
      .update({ likes: safeNextCount })
      .eq("id", item.id);

    if (error) {
      console.error("Like update error", error);
      // rollback
      setLiked(!nextLiked);
      setLikesCount(likesCount);
      showToast("Could not update like");
    }
  }

  // 6) share
  function getShareUrl() {
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    return `/drop/${dropId}`;
  }

  async function handleShare() {
    if (!item) return;
    const url = getShareUrl();
    const text = `${item.title} on ${BRAND.name} – check this drop: ${url}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text,
          url,
        });
        return;
      }
    } catch {
      // ignore and fallback to sheet
    }

    // fallback copy to clipboard + open share sheet
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        showToast("Link copied");
      } catch {
        // ignore
      }
    }
    setShowShareSheet(true);
  }

  // 7) comments – local only (no DB)
  function handleAddComment() {
    if (!commentText.trim()) return;
    setLocalComments((prev) => [
      { id: Date.now(), text: commentText.trim() },
      ...prev,
    ]);
    setCommentText("");
  }

  function handleOpenComments() {
    if (commentsRef.current) {
      commentsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }

  if (!dropId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">Invalid drop link.</p>
      </div>
    );
  }

  if (!item && !loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">
          Drop not found or has been removed.
        </p>
      </div>
    );
  }

  const descriptionImages = (item?.description_images || []) as string[];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
      {/* gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute right-[-40px] bottom-[-80px] h-80 w-80 rounded-full bg-sky-500/25 blur-3xl" />
      </div>

      {/* top bar with cart + wallet */}
      <header className="relative z-20 sticky top-0 flex items-center gap-3 px-4 py-3 bg-slate-950/95 backdrop-blur border-b border-slate-900">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-lg"
        >
          ←
        </button>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Drop detail
          </span>
          <span className="text-sm font-semibold">{BRAND.name}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <button
            onClick={() => router.push("/cart")}
            className="relative h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-lg"
            aria-label="Open cart"
          >
            🛒
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-semibold text-slate-950 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          <div className="text-right">
            <div className="text-[10px] text-slate-400">Wallet</div>
            <div className="text-xs font-semibold text-emerald-300">
              {wallet ? `₹${wallet.balance.toFixed(2)}` : "₹0.00"}
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-md px-4 pt-4 pb-16">
        {/* main card */}
        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 shadow-xl shadow-black/60 overflow-hidden">
          {/* cover */}
          {item?.cover_url && (
            <div className="w-full overflow-hidden bg-slate-900">
              <div className="aspect-[16/10] w-full">
                <img
                  src={item.cover_url}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* title + creator */}
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h1 className="text-lg font-semibold text-slate-50">
                    {item?.title || "Loading…"}
                  </h1>
                  {item?.creator_name && (
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
                        {item.creator_name.charAt(0).toUpperCase()}
                      </div>
                      <button
                        className="truncate max-w-[140px] underline underline-offset-2"
                        onClick={() =>
                          router.push(
                            `/creators/${encodeURIComponent(
                              item.creator_name as string
                            )}`
                          )
                        }
                      >
                        {item.creator_name}
                      </button>
                      <span className="h-1 w-1 rounded-full bg-slate-500" />
                      <button
                        className="text-slate-400 underline underline-offset-2"
                        onClick={() =>
                          router.push(
                            `/creators/${encodeURIComponent(
                              item.creator_name as string
                            )}`
                          )
                        }
                      >
                        View creator
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* NEW: like / share / comment row */}
              <div className="flex items-center gap-4 text-[11px] text-slate-300">
                <button
                  onClick={handleToggleLike}
                  className="flex items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 border border-slate-700/70"
                >
                  <span className="text-sm">{liked ? "❤️" : "🤍"}</span>
                  <span>{likesCount}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 border border-slate-700/70"
                >
                  <span className="text-sm">📤</span>
                  <span>Share</span>
                </button>

                <button
                  onClick={handleOpenComments}
                  className="flex items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 border border-slate-700/70"
                >
                  <span className="text-sm">💬</span>
                  <span>Comments</span>
                </button>
              </div>
            </div>

            {/* stats row 1 */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <DetailStat
                label="VIEWS"
                value={String(item?.views ?? 0)}
                icon="👁"
              />
              <DetailStat
                label="LIKES"
                value={String(item?.likes ?? likesCount)}
                icon="★"
              />
              <DetailStat
                label="CLAIMS"
                value={String(item?.claims ?? 0)}
                icon="💎"
              />
            </div>

            {/* stats row 2 */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <DetailStat
                label="STOCK LEFT"
                value={String(item?.stock ?? 0)}
                icon="📦"
              />
              <DetailStat
                label={`${BRAND.coinName.toUpperCase()}/CLAIM`}
                value={`+${item?.coins_per_claim ?? 0}`}
                icon="💠"
              />
              <DetailStat
                label="PRICE"
                value={isFree ? "Free" : `₹${item?.price ?? 0}`}
                icon="💰"
              />
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-2">
              {canAddToCart && (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="w-full h-10 rounded-full border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-100 disabled:opacity-60"
                >
                  {addingToCart ? "Adding…" : "Add to cart"}
                </button>
              )}

              <button
                type="button"
                onClick={handleBuyAndClaim}
                disabled={claiming || !canClaimNow}
                className="w-full h-11 rounded-full bg-violet-500 text-[12px] font-semibold text-slate-50 hover:bg-violet-400 disabled:opacity-60 shadow-lg shadow-violet-500/40"
              >
                {claiming
                  ? isFree
                    ? "Claiming..."
                    : "Processing..."
                  : isFree
                  ? "Claim now"
                  : "Buy and claim now"}
              </button>
            </div>

            {/* ownership */}
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Your ownership</h2>
              {hasClaim ? (
                <p className="text-[11px] text-slate-300">
                  You own this drop and have earned{" "}
                  <span className="font-semibold text-emerald-300">
                    {ownership?.coins ?? 0} Genstrok Coins
                  </span>{" "}
                  from it.
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  You have not claimed this drop yet. Be early and lock your
                  ownership.
                </p>
              )}
            </div>

            {/* description + images */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Drop details</h2>
              {item?.description ? (
                <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
                  {item.description}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  No additional description provided.
                </p>
              )}

              {descriptionImages && descriptionImages.length > 0 && (
                <div className="space-y-3">
                  {descriptionImages.map((url, idx) => (
                    <div
                      key={idx}
                      className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                    >
                      <div className="aspect-[4/3] w-full">
                        <img
                          src={url}
                          alt={`Drop detail image ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* files */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Drop files</h2>
              <button
                onClick={hasClaim ? handleOpenFile : undefined}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[12px] ${
                  hasClaim
                    ? "bg-slate-900/80 border border-slate-700/80"
                    : "bg-slate-900/40 border border-slate-800/80"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📎</span>
                  <span className="truncate">
                    {hasClaim
                      ? "Your file is unlocked – tap to open"
                      : "Locked file – claim to unlock"}
                  </span>
                </div>
                <span className="text-[11px] text-violet-300">
                  {hasClaim ? "Open file →" : "Locked"}
                </span>
              </button>
              {!hasClaim && (
                <p className="mt-1 text-[11px] text-slate-400">
                  This attachment will unlock automatically after your claim is
                  successful.
                </p>
              )}
            </div>

            {/* comments */}
            <div ref={commentsRef} className="space-y-2 pt-2">
              <h2 className="text-sm font-semibold">Comments</h2>
              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment (local only)"
                  className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-100"
                />
                <button
                  onClick={handleAddComment}
                  className="rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-slate-50"
                >
                  Post
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {localComments.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No comments yet.
                  </p>
                ) : (
                  localComments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-2 text-[11px] text-slate-200"
                    >
                      {c.text}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* creator card */}
            {item?.creator_name && (
              <div className="space-y-1 pt-2">
                <h2 className="text-sm font-semibold">Creator</h2>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-[11px]">
                  <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-[11px]">
                    {item.creator_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">
                      {item.creator_name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Publishing drops on {BRAND.name} ownership sandbox.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      router.push(
                        `/creators/${encodeURIComponent(
                          item.creator_name as string
                        )}`
                      )
                    }
                    className="text-[11px] text-violet-300 underline underline-offset-2"
                  >
                    View all drops
                  </button>
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-500 pt-1">
              Claim this drop on {BRAND.name} to earn {BRAND.coinName} and
              secure your early ownership record.
            </p>
          </div>
        </section>

        <p className="mt-4 text-[10px] text-slate-500 text-center">
          Built on {BRAND.name}. Every claim is a tiny piece of digital
          ownership.
        </p>
      </main>

      {/* share sheet */}
      {showShareSheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 pb-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/95 p-4 text-[11px] text-slate-100 shadow-xl shadow-slate-900/80">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Share drop</p>
              <button
                onClick={() => setShowShareSheet(false)}
                className="h-7 w-7 rounded-full bg-slate-900 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3 text-center">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  getShareUrl()
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1"
              >
                <span className="text-xl">🟢</span>
                <span>WhatsApp</span>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  getShareUrl()
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1"
              >
                <span className="text-xl">📨</span>
                <span>Telegram</span>
              </a>
              <a
                href={`https://x.com/intent/tweet?url=${encodeURIComponent(
                  getShareUrl()
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1"
              >
                <span className="text-xl">𝕏</span>
                <span>X</span>
              </a>
              <button
                onClick={async () => {
                  const url = getShareUrl();
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    try {
                      await navigator.clipboard.writeText(url);
                      showToast("Link copied");
                    } catch {
                      // ignore
                    }
                  }
                }}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-xl">📋</span>
                <span>Copy link</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Link is already copied. Choose any app above or paste
              manually.
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="max-w-sm rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 shadow-lg shadow-emerald-900/40">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs">{icon}</span>
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
      <span className="text-[11px] text-slate-200 font-medium">
        {value}
      </span>
    </div>
  );
}