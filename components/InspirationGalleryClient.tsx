"use client";

import { useState, useRef, useCallback, useEffect, startTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Palette, Heart, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toProxyUrl, resolveImageUrls } from "@/lib/image-url";
import type { InspirationItem } from "@/lib/inspiration";

interface Props {
  initialItems: InspirationItem[];
  total: number;
  currentUserId?: string;
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function getColCount(w: number) {
  if (w >= 1024) return 4;
  if (w >= 640) return 3;
  return 2;
}

function getGap(w: number) {
  return w >= 768 ? 16 : 12;
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
    const p = parseInt(raw, 10);
    return p > 1 ? p : null;
  } catch { return null; }
}

interface CardPos {
  top: number;
  left: number;
  width: number;
  height: number;
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

  // ========== 瀑布流布局 ==========
  // positions 记录每个 item 的绝对位置，一旦设定就不变
  const [positions, setPositions] = useState<Map<string, CardPos>>(() => new Map());
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<Map<string, HTMLDivElement>>(new Map());
  // 初始布局是否完成（防止首次渲染时闪烁）
  const layoutDone = useRef(false);

  // 给新 item 分配位置（只处理没有位置的 item，已有位置的不动）
  const layoutNew = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.offsetWidth;
    const cols = getColCount(w);
    const gap = getGap(w);
    const colW = (w - gap * (cols - 1)) / cols;

    // 从已有 positions 恢复各列高度
    const colH = new Array(cols).fill(0);
    const pos = new Map(positions);

    for (const [, p] of pos) {
      const col = Math.round(p.left / (colW + gap));
      const bottom = p.top + p.height + gap;
      if (bottom > (colH[col] || 0)) colH[col] = bottom;
    }

    let changed = false;
    for (const item of items) {
      if (pos.has(item._id)) continue;
      const el = cardEls.current.get(item._id);
      if (!el) continue;

      const h = el.offsetHeight || 200;
      // 找最矮列
      let min = 0;
      for (let c = 1; c < cols; c++) {
        if ((colH[c] || 0) < (colH[min] || 0)) min = c;
      }
      const left = min * (colW + gap);
      const top = colH[min] || 0;
      pos.set(item._id, { top, left, width: colW, height: h });
      colH[min] = top + h + gap;
      changed = true;
    }

    if (changed) {
      setPositions(pos);
      setContainerHeight(Math.max(...colH, 0));
      // 首次布局完成后恢复滚动位置（必须在容器高度设置后）
      if (!layoutDone.current) {
        layoutDone.current = true;
        if (!returnScrollDoneRef.current) {
          returnScrollDoneRef.current = true;
          const saved = sessionStorage.getItem("inspiration-scroll");
          if (saved !== null) {
            requestAnimationFrame(() => {
              const mainEl = document.querySelector("main");
              if (mainEl) mainEl.scrollTop = Number(saved);
              sessionStorage.removeItem("inspiration-scroll");
            });
          }
          setScrollReady(true);
        }
      }
    }
  }, [items, positions]);

  // DOM 更新后给新 item 定位
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const t = setTimeout(layoutNew, 0);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, [items, layoutNew]);

  // Resize 时全量重排（列数变了需要重算）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const w = container.offsetWidth;
      const cols = getColCount(w);
      const gap = getGap(w);
      const colW = (w - gap * (cols - 1)) / cols;
      const colH = new Array(cols).fill(0);
      const newPos = new Map<string, CardPos>();

      for (const item of items) {
        const el = cardEls.current.get(item._id);
        const h = el?.offsetHeight || 200;
        let min = 0;
        for (let c = 1; c < cols; c++) {
          if ((colH[c] || 0) < (colH[min] || 0)) min = c;
        }
        const left = min * (colW + gap);
        const top = colH[min] || 0;
        newPos.set(item._id, { top, left, width: colW, height: h });
        colH[min] = top + h + gap;
      }
      setPositions(newPos);
      setContainerHeight(Math.max(...colH, 0));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [items]);

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
        const results = await Promise.all(pageNumbers.map((p) => fetch(`/api/inspiration?page=${p}`).then((r) => r.json())));
        const allExtra = results.flatMap((r) => r.items || []);
        const seen = new Set(items.map((it) => it._id));
        const fresh = allExtra.filter((it: InspirationItem) => { if (seen.has(it._id)) return false; seen.add(it._id); return true; });
        if (fresh.length > 0) { const merged = [...items, ...fresh]; modItems = merged; modPage = savedPageCount; loadedImageIds.current.clear(); setImagesAllLoaded(true); setItems(merged); setPage(savedPageCount); resolveImageUrls(merged.map((it: InspirationItem) => it.image_url)); }
        else { setImagesAllLoaded(true); }
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
        if (data.items?.length) { modItems = data.items; modPage = 1; loadedImageIds.current.clear(); setImagesAllLoaded(true); setItems(data.items); resolveImageUrls(data.items.map((it: InspirationItem) => it.image_url)); if (typeof data.total === "number") { setTotal(data.total); modTotal = data.total; } }
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
          modItems = merged; modPage = targetPage; loadedImageIds.current.clear(); setImagesAllLoaded(true); setItems(merged); setPage(targetPage); resolveImageUrls(merged.map((it: InspirationItem) => it.image_url));
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
  // 追踪新加载的 item，用于淡入动画
  const newItemIds = useRef<Set<string>>(new Set());
  // 追踪每张图片开始加载的时间
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const imgLoadStarts = useRef(new Map<string, number>()).current;
  // 追踪当前批次图片加载状态，全部加载完才允许加载下一批
  const loadedImageIds = useRef<Set<string>>(new Set());
  // 有待恢复的页码或已有 item 时，初始为 false（等图片加载完再允许加载下一批）
  const [imagesAllLoaded, setImagesAllLoaded] = useState(savedPageCount <= 1 && modItems.length === 0);
  async function loadMore() {
    if (loadingRef.current || !hasMore || loadingMore || !imagesAllLoaded) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setImagesAllLoaded(false);
    const nextPage = page + 1;
    const t0 = performance.now();
    try {
      const tFetch = performance.now();
      const res = await fetch(`/api/inspiration?page=${nextPage}`);
      if (res.status === 429) { toast.error("加载太快了，稍后再试"); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      const items = data.items as InspirationItem[];
      console.log(`[img] loadMore page ${nextPage}: fetch ${Math.round(performance.now() - tFetch)}ms, ${items.length} items`);
      if (typeof data.total === "number") { setTotal(data.total); modTotal = data.total; }
      // 先解析临时 URL，避免浏览器请求 serverless 代理
      const tResolve = performance.now();
      await resolveImageUrls(items.map((it) => it.image_url));
      console.log(`[img] loadMore resolveImageUrls ${Math.round(performance.now() - tResolve)}ms`);
      // 记录新加载的 item ID，用于动画
      const newIds = new Set(items.map((it) => it._id));
      for (const id of newIds) newItemIds.current.add(id);
      setItems((prev) => { const next = [...prev, ...items]; syncMod(next, nextPage); return next; });
      setPage(nextPage);
      console.log(`[img] loadMore total ${Math.round(performance.now() - t0)}ms (page ${nextPage} ready)`);
      // 动画结束后清除标记
      setTimeout(() => { for (const id of newIds) newItemIds.current.delete(id); }, 500);
      try { sessionStorage.setItem(STORAGE_KEY, String(nextPage)); } catch {}
    } catch { toast.error("加载失败，请重试"); }
    finally { loadingRef.current = false; setLoadingMore(false); }
  }

  // Sentinel — 图片全部加载完才触发下一批
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loadingMore || !imagesAllLoaded) return;
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { root: document.querySelector("main"), rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [page, hasMore, loadingMore, imagesAllLoaded]);

  // Polling
  useEffect(() => {
    let pending = false; let timer: ReturnType<typeof setTimeout> | null = null;
    async function refresh() {
      if (pending || document.visibilityState !== "visible" || modPage > 1) return;
      pending = true;
      try { const res = await fetch("/api/inspiration?page=1"); if (!res.ok) return; const data = await res.json(); if (data.items?.length && data.items[0]?._id !== modItems?.[0]?._id) { modItems = data.items; modPage = 1; loadedImageIds.current.clear(); setImagesAllLoaded(true); setItems(data.items); resolveImageUrls(data.items.map((it: InspirationItem) => it.image_url)); setPage(1); if (typeof data.total === "number") { setTotal(data.total); modTotal = data.total; } } } finally { pending = false; }
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
    for (const [, el] of cardEls.current) observer.observe(el);
    return () => observer.disconnect();
  }, [router, items]);

  // Scroll restore — 延迟到瀑布流布局完成后执行，否则容器高度为 0 会滚回顶部
  const returnScrollDoneRef = useRef(false);
  const [scrollReady, setScrollReady] = useState(false);

  // Return animation
  const [returnAnim, setReturnAnim] = useState<{
    id: string; item: InspirationItem;
    from: { top: number; left: number; width: number; height: number };
    to: { top: number; left: number; width: number; height: number };
    phase: "positioning" | "animating";
  } | null>(null);

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
        const t = el.getBoundingClientRect();
        if (t.width === 0 || t.height === 0) { requestAnimationFrame(tryAnim); return; }
        returnAnimIdRef.current = null;
        document.body.removeAttribute("data-return");
        setReturnAnim({ id, item, from: { top, left, width, height }, to: { top: t.top, left: t.left, width: t.width, height: t.height }, phase: "positioning" });
        requestAnimationFrame(() => requestAnimationFrame(() => setReturnAnim((p) => p ? { ...p, phase: "animating" } : null)));
      };
      requestAnimationFrame(() => requestAnimationFrame(tryAnim));
    } catch {}
  }, [scrollReady, items]);

  const persistPage = useCallback((p: number) => { try { sessionStorage.setItem(STORAGE_KEY, String(p)); } catch {} }, []);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  function onImageLoad(id: string) {
    loadedImageIds.current.add(id);
    // 检查是否所有当前 item 的图片都已加载
    if (loadedImageIds.current.size >= items.length) {
      setImagesAllLoaded(true);
    }
  }

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
            {/* 瀑布流：absolute 定位 + 列追踪，新 item 只追加到最矮列底部 */}
            <div ref={containerRef} className="relative w-full" style={{ height: containerHeight || undefined }}>
              {(() => { let batchIdx = 0; return items.map((item) => {
                const pos = positions.get(item._id);
                const isNew = newItemIds.current.has(item._id);
                const delay = isNew ? batchIdx++ * 60 : 0;
                return (
                  <div
                    key={item._id}
                    ref={(el) => {
                      if (el) { cardEls.current.set(item._id, el); cardRefs.current.set(item._id, el); }
                      else { cardEls.current.delete(item._id); cardRefs.current.delete(item._id); }
                    }}
                    data-card
                    data-item-id={item._id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleCardClick(item, e)}
                    className={`absolute cursor-pointer${isNew ? " animate-fadein" : ""}`}
                    style={pos ? {
                      top: pos.top, left: pos.left, width: pos.width,
                      "--card-delay": `${delay}ms`,
                      visibility: (returnAnim?.id === item._id || returnAnimIdRef.current === item._id) ? "hidden" : "visible",
                    } as React.CSSProperties : { visibility: "hidden" }}
                  >
                    <div className="group relative overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                      {/* 预设 aspectRatio 防止高度变化 */}
                      <div style={{ aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : "3/4" }} className="w-full bg-gray-50">
                        <img
                          src={toProxyUrl(item.image_url)}
                          alt={item.prompt}
                          loading="lazy"
                          decoding="async"
                          onLoad={(e) => {
                            const start = imgLoadStarts.get(item._id) || 0;
                            const ms = start ? Math.round(performance.now() - start) : 0;
                            const src = e.currentTarget.src.substring(0, 80);
                            const isProxy = src.includes("/api/images/");
                            console.log(`[img] loaded ${item._id.slice(0, 8)} ${ms}ms ${isProxy ? "PROXY" : "CDN"} ${src}`);
                            imgLoadStarts.delete(item._id);
                            onImageLoad(item._id);
                          }}
                          ref={(el) => { if (el) imgLoadStarts.set(item._id, performance.now()); else imgLoadStarts.delete(item._id); }}
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
                );
              }); })()}
            </div>

            {loadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-gray-400" />
              </div>
            )}

            {!loadingMore && !imagesAllLoaded && hasMore && (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="size-4 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">图片加载中...</span>
              </div>
            )}

            {!loadingMore && imagesAllLoaded && hasMore && (
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
