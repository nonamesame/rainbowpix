"use client";

import { useState, useRef, useCallback, useEffect, startTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Palette, Heart, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toProxyUrl } from "@/lib/image-url";
import type { InspirationItem } from "@/lib/inspiration";

interface Props {
  initialItems: InspirationItem[];
  total: number;
  currentUserId?: string;
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

// 默认宽高比 3:4（竖图居多），有 width/height 时用实际比例
function getAspectRatio(item: InspirationItem): string {
  if (item.width && item.height) return `${item.width}/${item.height}`;
  return "3/4";
}

const STORAGE_KEY = "inspiration-gallery-page";
const STORAGE_FIRST_ID_KEY = "inspiration-gallery-first-id";

let modItems: InspirationItem[] | null = null;
let modPage = 1;
let modTotal = 0;

function loadSavedPage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const page = parseInt(raw, 10);
    return page > 1 ? page : null;
  } catch { return null; }
}

export default function InspirationGalleryClient({
  initialItems, total: initialTotal, currentUserId,
}: Props) {
  const savedPage = useRef(loadSavedPage());

  const returnAnimIdRef = useRef<string | null>(null);
  if (returnAnimIdRef.current === null && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("inspiration-return-anim");
      if (raw) {
        const id = JSON.parse(raw).id;
        returnAnimIdRef.current = id;
        document.body.setAttribute("data-return", id);
      }
    } catch {}
  }

  let savedPageCount = 1;
  let savedFirstId: string | null = null;
  try {
    savedPageCount = parseInt(sessionStorage.getItem(STORAGE_KEY) || "", 10) || 1;
    savedFirstId = sessionStorage.getItem(STORAGE_FIRST_ID_KEY);
  } catch {}

  if (modItems === null) {
    modItems = initialItems;
    modPage = savedPageCount > 1 ? savedPageCount : 1;
  }

  const [items, setItems] = useState<InspirationItem[]>(modItems);
  const [loading, setLoading] = useState(modItems.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(modTotal || initialTotal);
  const router = useRouter();
  const hasMore = total > 0 && items.length < total;

  // ========== 数据管理 ==========
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(modPage));
      if (items.length > 0) sessionStorage.setItem(STORAGE_FIRST_ID_KEY, items[0]._id);
    } catch {}
  }, [items]);

  const [page, setPage] = useState(modPage);

  // Recovery
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;
    if (savedPageCount <= 1 || !savedFirstId) return;
    if (items.length > 0 && items[0]._id === savedFirstId) return;
    (async () => {
      try {
        const pageNumbers = Array.from({ length: savedPageCount - 1 }, (_, i) => i + 2);
        const results = await Promise.all(
          pageNumbers.map((p) => fetch(`/api/inspiration?page=${p}`).then((r) => r.json()))
        );
        const allExtra = results.flatMap((r) => r.items || []);
        const seen = new Set(items.map((it) => it._id));
        const fresh = allExtra.filter((it: InspirationItem) => { if (seen.has(it._id)) return false; seen.add(it._id); return true; });
        if (fresh.length > 0) { const merged = [...items, ...fresh]; modItems = merged; modPage = savedPageCount; setItems(merged); setPage(savedPageCount); }
      } catch {}
    })();
  }, []);

  // Initial fetch
  useEffect(() => {
    if (initialItems.length > 0 || items.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/inspiration?page=1");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (data.items?.length) { modItems = data.items; modPage = 1; setItems(data.items); if (typeof data.total === "number") { setTotal(data.total); modTotal = data.total; } }
        setLoading(false);
      } catch { setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [initialItems.length]);

  const syncMod = useCallback((newItems: InspirationItem[], newPage: number) => {
    modItems = newItems; modPage = newPage;
    if (newPage > 1) { try { sessionStorage.setItem(STORAGE_KEY, String(newPage)); } catch {} }
  }, []);

  // Back-nav recovery
  useEffect(() => {
    const targetPage = savedPage.current;
    if (!targetPage || targetPage <= 1) return;
    savedPage.current = null;
    (async () => {
      try {
        const pageNumbers = [1, ...Array.from({ length: targetPage - 1 }, (_, i) => i + 2)];
        const results = await Promise.all(pageNumbers.map((p) => fetch(`/api/inspiration?page=${p}`).then((r) => r.json())));
        const page1Data = results[0];
        if (typeof page1Data?.total === "number") { setTotal(page1Data.total); modTotal = page1Data.total; }
        const allItems = results.flatMap((r) => r.items || []);
        if (allItems.length > 0) {
          const seen = new Set<string>();
          const merged = allItems.filter((it: InspirationItem) => { if (seen.has(it._id)) return false; seen.add(it._id); return true; });
          modItems = merged; modPage = targetPage; setItems(merged); setPage(targetPage);
        } else { modPage = targetPage; setPage(targetPage); }
      } catch {}
    })();
  }, []);

  // Total fallback
  useEffect(() => {
    if (total > 0 || items.length === 0) return;
    let cancelled = false;
    (async () => {
      try { const res = await fetch("/api/inspiration?page=1"); if (cancelled || !res.ok) return; const data = await res.json(); if (typeof data.total === "number") { setTotal(data.total); modTotal = data.total; } } catch {}
    })();
    return () => { cancelled = true; };
  }, [total, items.length]);

  // ========== Load More ==========
  const loadingRef = useRef(false);
  async function loadMore() {
    if (loadingRef.current || !hasMore || loadingMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/inspiration?page=${nextPage}`);
      if (res.status === 429) { toast.error("加载太快了，稍后再试"); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (typeof data.total === "number") { setTotal(data.total); modTotal = data.total; }
      setItems((prev) => { const next = [...prev, ...data.items]; syncMod(next, nextPage); return next; });
      setPage(nextPage);
      try { sessionStorage.setItem(STORAGE_KEY, String(nextPage)); } catch {}
    } catch { toast.error("加载失败，请重试"); }
    finally { loadingRef.current = false; setLoadingMore(false); }
  }

  // Sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loadingMore) return;
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { root: document.querySelector("main"), rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [page, hasMore, loadingMore]);

  // Polling
  useEffect(() => {
    let pending = false; let timer: ReturnType<typeof setTimeout> | null = null;
    async function refresh() {
      if (pending || document.visibilityState !== "visible" || modPage > 1) return;
      pending = true;
      try { const res = await fetch("/api/inspiration?page=1"); if (!res.ok) return; const data = await res.json(); if (data.items?.length && data.items[0]?._id !== modItems?.[0]?._id) { modItems = data.items; modPage = 1; setItems(data.items); setPage(1); if (typeof data.total === "number") { setTotal(data.total); modTotal = data.total; } } } finally { pending = false; }
    }
    function tick() { refresh(); timer = setTimeout(tick, 60_000); }
    function onVis() { if (document.visibilityState === "visible") { refresh(); if (!timer) timer = setTimeout(tick, 60_000); } else { if (timer) { clearTimeout(timer); timer = null; } } }
    if (document.visibilityState === "visible") { refresh(); timer = setTimeout(tick, 60_000); }
    document.addEventListener("visibilitychange", onVis);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // Prefetch
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) { const id = e.target.getAttribute("data-item-id"); if (id) router.prefetch(`/inspiration/${id}`); } } },
      { rootMargin: "200px" }
    );
    document.querySelectorAll("[data-item-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [router, items]);

  // Scroll restore
  const returnScrollDoneRef = useRef(false);
  const [scrollReady, setScrollReady] = useState(false);
  useEffect(() => {
    if (returnScrollDoneRef.current) return;
    const saved = sessionStorage.getItem("inspiration-scroll");
    if (saved === null) { returnScrollDoneRef.current = true; setScrollReady(true); return; }
    returnScrollDoneRef.current = true;
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTop = Number(saved);
    sessionStorage.removeItem("inspiration-scroll");
    setScrollReady(true);
  }, []);

  // Return animation
  const [returnAnim, setReturnAnim] = useState<{
    id: string; item: InspirationItem;
    from: { top: number; left: number; width: number; height: number };
    to: { top: number; left: number; width: number; height: number };
    phase: "positioning" | "animating";
  } | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!scrollReady) return;
    const raw = sessionStorage.getItem("inspiration-return-anim");
    if (!raw) return;
    sessionStorage.removeItem("inspiration-return-anim");
    try {
      const { id, top, left, width, height } = JSON.parse(raw);
      const item = items.find((it) => it._id === id);
      if (!item) return;
      const tryAnim = () => {
        const el = cardRefs.current.get(id);
        if (!el) return;
        const target = el.getBoundingClientRect();
        if (target.width === 0 || target.height === 0) { requestAnimationFrame(tryAnim); return; }
        returnAnimIdRef.current = null;
        document.body.removeAttribute("data-return");
        setReturnAnim({ id, item, from: { top, left, width, height }, to: { top: target.top, left: target.left, width: target.width, height: target.height }, phase: "positioning" });
        requestAnimationFrame(() => requestAnimationFrame(() => setReturnAnim((p) => p ? { ...p, phase: "animating" } : null)));
      };
      requestAnimationFrame(() => requestAnimationFrame(tryAnim));
    } catch {}
  }, [scrollReady, items]);

  const persistPage = useCallback((p: number) => { try { sessionStorage.setItem(STORAGE_KEY, String(p)); } catch {} }, []);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  function handleCardClick(item: InspirationItem, e: React.MouseEvent) {
    const card = (e.target as HTMLElement).closest("[data-card]");
    if (card) {
      const rect = card.getBoundingClientRect();
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k !== STORAGE_KEY && k !== STORAGE_FIRST_ID_KEY && k !== "inspiration-scroll" && k !== "inspiration-return-anim" && k !== "inspiration-card-anim" && k !== "theme" && !k.startsWith("announcement_shown_")) sessionStorage.removeItem(k);
        }
      } catch {}
      try { sessionStorage.setItem("inspiration-card-anim", JSON.stringify({ src: toProxyUrl(item.image_url), top: rect.top, left: rect.left, width: rect.width, height: rect.height })); } catch {}
    }
    persistPage(page);
    const mainEl = document.querySelector("main");
    if (mainEl) { try { sessionStorage.setItem("inspiration-scroll", String(mainEl.scrollTop)); } catch {} }
    startTransition(() => { router.push(`/inspiration/${item._id}`, { scroll: false }); });
  }

  async function handleCardLike(e: React.MouseEvent, item: InspirationItem) {
    e.stopPropagation();
    if (!currentUserId) { toast.error("请先登录"); return; }
    if (likingIds.has(item._id)) return;
    setLikingIds((p) => new Set(p).add(item._id));
    setAnimatingIds((p) => new Set(p).add(item._id));
    setTimeout(() => { setAnimatingIds((p) => { const n = new Set(p); n.delete(item._id); return n; }); }, 400);
    const wasLiked = item.user_liked ?? false;
    const newCount = wasLiked ? (item.likes_count || 1) - 1 : (item.likes_count || 0) + 1;
    setItems((prev) => { const next = prev.map((it) => it._id === item._id ? { ...it, user_liked: !wasLiked, likes_count: newCount } : it); syncMod(next, modPage); return next; });
    try {
      const res = await fetch(`/api/inspiration/${item._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems((prev) => { const next = prev.map((it) => it._id === item._id ? { ...it, user_liked: data.liked, likes_count: data.likes_count } : it); syncMod(next, modPage); return next; });
      if (data.liked) window.dispatchEvent(new Event("task-action"));
    } catch {
      setItems((prev) => { const next = prev.map((it) => it._id === item._id ? { ...it, user_liked: wasLiked, likes_count: item.likes_count || 0 } : it); syncMod(next, modPage); return next; });
      toast.error("操作失败，请重试");
    } finally { setLikingIds((p) => { const n = new Set(p); n.delete(item._id); return n; }); }
  }

  return (
    <div>
      <div className="px-6 py-6 md:px-12 lg:px-20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">灵感大厅</h1>
            <p className="mt-1 text-sm text-gray-500">发现属于你的提示词</p>
          </div>
          <Link href="/generate">
            <Button className="bg-brand hover:bg-brand-dark"><Palette className="mr-1.5 size-4" />AI绘画</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-brand" />
            <span className="ml-3 text-gray-500">加载中...</span>
          </div>
        ) : items.length > 0 ? (
          <>
            {/* CSS columns 瀑布流 — 图片预设 aspectRatio 防止高度变化触发重排 */}
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 md:gap-4">
              {items.map((item) => (
                <div
                  key={item._id}
                  ref={(el) => { if (el) cardRefs.current.set(item._id, el); else cardRefs.current.delete(item._id); }}
                  data-card
                  data-item-id={item._id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleCardClick(item, e)}
                  className="mb-3 md:mb-4 break-inside-avoid cursor-pointer group"
                  style={(returnAnim?.id === item._id || returnAnimIdRef.current === item._id) ? { visibility: "hidden" } : undefined}
                >
                  <div className="relative overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                    {/* 预设 aspectRatio 占位，防止 lazy load 高度变化 */}
                    <div style={{ aspectRatio: getAspectRatio(item) }} className="w-full bg-gray-50">
                      <img
                        src={toProxyUrl(item.image_url)}
                        alt={item.prompt}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <div className="absolute bottom-0 left-0 max-w-[70%] p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <p className="truncate text-xs font-medium text-white drop-shadow-md">{item.title || truncate(item.prompt, 20)}</p>
                    </div>
                    <button
                      onClick={(e) => handleCardLike(e, item)}
                      disabled={likingIds.has(item._id)}
                      className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs opacity-0 transition-all duration-200 group-hover:opacity-100 disabled:opacity-70 ${item.user_liked ? "text-red-500" : "text-white hover:text-red-500"}`}
                    >
                      <Heart className={`size-3.5 transition-transform ${animatingIds.has(item._id) ? "animate-heart" : ""} ${item.user_liked ? "fill-red-500" : ""}`} />
                      <span>{item.likes_count || 0}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 加载中：底部转圈 */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-gray-400" />
              </div>
            )}

            {/* 非加载中 + 还有更多：sentinel */}
            {!loadingMore && hasMore && (
              <div ref={sentinelRef} className="h-1" />
            )}

            {!hasMore && total > 0 && (
              <p className="py-8 text-center text-xs text-gray-400">— 已经到底了 —</p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ImageIcon className="mb-4 size-12" />
            <p className="text-sm">暂无灵感作品</p>
            <Link href="/generate" className="mt-4"><Button>去创作</Button></Link>
          </div>
        )}
      </div>

      {returnAnim && createPortal(
        <div
          style={{
            position: "fixed",
            top: returnAnim.phase === "positioning" ? returnAnim.from.top : returnAnim.to.top,
            left: returnAnim.phase === "positioning" ? returnAnim.from.left : returnAnim.to.left,
            width: returnAnim.phase === "positioning" ? returnAnim.from.width : returnAnim.to.width,
            height: returnAnim.phase === "positioning" ? returnAnim.from.height : returnAnim.to.height,
            zIndex: 9999, overflow: "hidden", borderRadius: "0.5rem",
            transition: returnAnim.phase === "animating" ? "all 0.35s cubic-bezier(0.2, 0, 0, 1)" : "none",
          }}
          onTransitionEnd={() => setReturnAnim(null)}
        >
          <img src={toProxyUrl(returnAnim.item.image_url)} alt={returnAnim.item.prompt} className="w-full h-full block object-cover" />
        </div>,
        document.body
      )}
    </div>
  );
}
