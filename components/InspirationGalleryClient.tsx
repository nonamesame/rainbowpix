"use client";

import { useState, useRef, useLayoutEffect, useCallback, useEffect, startTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Palette, Heart, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toProxyUrl } from "@/lib/image-url";
import { getDb, getAuth } from "@/lib/cloudbase/client";
import type { InspirationItem } from "@/lib/inspiration";

interface Props {
  initialItems: InspirationItem[];
  total: number;
  currentUserId?: string;
}

interface CardPos {
  top: number;
  left: number;
  width: number;
  height: number;
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function getColumnCount(width: number) {
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

function getGap(width: number) {
  return width >= 768 ? 16 : 12;
}

const STORAGE_KEY = "inspiration-gallery-page";

// Module-level store: survives React component remounts caused by RSC reconciliation.
// Without this, each remount resets useState to initialItems, losing loaded-more data.
let modItems: InspirationItem[] | null = null;
let modPage = 1;

function loadSavedPage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const page = parseInt(raw, 10);
    return page > 1 ? page : null;
  } catch {
    return null;
  }
}

export default function InspirationGalleryClient({
  initialItems,
  total: initialTotal,
  currentUserId,
}: Props) {
  const savedPage = useRef(loadSavedPage());

  // Detect return-animation on mount so the card is hidden before first paint.
  // Sets body[data-return] so CSS can hide the card immediately (before React effects run).
  const returnAnimIdRef = useRef<string | null>(null);
  if (returnAnimIdRef.current === null && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("inspiration-return-anim");
      if (raw) {
        const id = JSON.parse(raw).id;
        returnAnimIdRef.current = id;
        // Sync fallback in case blocking script didn't run (e.g. first visit)
        document.body.setAttribute("data-return", id);
      }
    } catch {}
  }

  // Initialize module store from server data on first load
  if (modItems === null) {
    modItems = initialItems;
    modPage = 1;
  }

  const [items, setItems] = useState<InspirationItem[]>(modItems);
  const [loading, setLoading] = useState(modItems.length === 0);
  const router = useRouter();

  const [page, setPage] = useState(modPage);

  // Client-side fetch from CloudBase when initialItems is empty (EdgeOne Pages)
  useEffect(() => {
    if (initialItems.length > 0) return; // already have server data
    let cancelled = false;

    (async () => {
      try {
        const db = getDb();
        const col = db.collection("generations");
        const { data } = await col
          .where({ published: true })
          .field([
            "prompt", "model", "image_url", "reference_image_url",
            "created_at", "user_id", "username", "likes_count",
            "watermark_enabled", "title", "width", "height",
          ])
          .orderBy("created_at", "desc")
          .limit(20)
          .get();
        if (cancelled) return;
        const fetched = (data || []).map((item: any) => ({ ...item, user_liked: false }));
        modItems = fetched;
        modPage = 1;
        setItems(fetched);
        setLoading(false);

        // Fetch total count
        const { total } = await col.where({ published: true }).count();
        // total is used via prop, but we can store it if needed
      } catch (e) {
        console.error("Failed to load inspiration gallery:", e);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [initialItems.length]);

  // Sync module store whenever state changes
  const syncMod = useCallback((newItems: InspirationItem[], newPage: number) => {
    modItems = newItems;
    modPage = newPage;
  }, []);

  // If returning from detail with more pages loaded, re-fetch them.
  // Uses module-level modItems to survive RSC remounts.
  useEffect(() => {
    const targetPage = savedPage.current;
    if (!targetPage || targetPage <= 1) return;
    savedPage.current = null; // only run once

    (async () => {
      try {
        const pageNumbers = Array.from({ length: targetPage - 1 }, (_, i) => i + 2);
        const results = await Promise.all(
          pageNumbers.map((p) => fetch(`/api/inspiration?page=${p}`).then((r) => r.json()))
        );
        const allExtra = results.flatMap((r) => r.items || []);
        if (allExtra.length > 0) {
          // Always append to modItems (which survives remounts), with dedup
          const existingIds = new Set((modItems || []).map((it) => it._id));
          const fresh = allExtra.filter((it) => !existingIds.has(it._id));
          const merged = [...(modItems || []), ...fresh];
          modItems = merged;
          modPage = targetPage;
          setItems(merged);
          setPage(targetPage);
        } else {
          modPage = targetPage;
          setPage(targetPage);
        }
      } catch (e) {
        console.error("[Gallery] re-fetch error:", e);
      }
    })();
  }, []);

  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const [returnAnim, setReturnAnim] = useState<{
    id: string;
    item: InspirationItem;
    from: { top: number; left: number; width: number; height: number };
    to: { top: number; left: number; width: number; height: number };
    phase: "positioning" | "animating";
  } | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<string, CardPos>>(new Map());
  const [positions, setPositions] = useState<Map<string, CardPos>>(new Map());
  const [containerHeight, setContainerHeight] = useState(0);
  const renderedIdsRef = useRef<Set<string>>(new Set());

  // Ref callback: sync position into ref, batch state update at end of render
  const cardRefCallback = useCallback((id: string, el: HTMLDivElement | null) => {
    if (!el) {
      cardRefs.current.delete(id);
      return;
    }
    cardRefs.current.set(id, el);

    // Skip if we already calculated positions for this item set
    if (renderedIdsRef.current.has(id)) return;

    const container = containerRef.current;
    if (!container) return;

    // Check if ALL items have refs
    const allReady = items.every((it) => cardRefs.current.has(it._id));
    if (!allReady) return;

    // Mark as rendered so we don't recalculate on every ref callback
    items.forEach((it) => renderedIdsRef.current.add(it._id));

    const containerWidth = container.offsetWidth;
    const cols = getColumnCount(containerWidth);
    const gap = getGap(containerWidth);
    const colWidth = (containerWidth - gap * (cols - 1)) / cols;
    const colHeights = new Array(cols).fill(0);
    const newPositions = new Map<string, CardPos>();

    for (const item of items) {
      let minCol = 0;
      for (let c = 1; c < cols; c++) {
        if (colHeights[c] < colHeights[minCol]) minCol = c;
      }
      const el = cardRefs.current.get(item._id);
      const height = el?.offsetHeight || 0;
      const left = minCol * (colWidth + gap);
      const top = colHeights[minCol];
      newPositions.set(item._id, { top, left, width: colWidth, height });
      colHeights[minCol] = top + height + gap;
    }

    positionsRef.current = newPositions;
    // Batch: set positions + height in one render
    setPositions(new Map(newPositions));
    setContainerHeight(Math.max(...colHeights, 0));
  }, [items]);

  // Reset refs when items change so positions are recalculated.
  // Must happen during render (not in effect) because ref callbacks fire
  // during commit phase BEFORE effects — if we clear in effect, ref callbacks
  // already ran with stale refs and skipped position calculation.
  const prevItemsRef = useRef(items);
  if (prevItemsRef.current !== items) {
    prevItemsRef.current = items;
    renderedIdsRef.current.clear();
    cardRefs.current.clear();
  }

  // ResizeObserver — recalculate on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const containerWidth = container.offsetWidth;
      const cols = getColumnCount(containerWidth);
      const gap = getGap(containerWidth);
      const colWidth = (containerWidth - gap * (cols - 1)) / cols;
      const colHeights = new Array(cols).fill(0);
      const newPositions = new Map<string, CardPos>();

      for (const item of items) {
        let minCol = 0;
        for (let c = 1; c < cols; c++) {
          if (colHeights[c] < colHeights[minCol]) minCol = c;
        }
        const el = cardRefs.current.get(item._id);
        const height = el?.offsetHeight || 0;
        const left = minCol * (colWidth + gap);
        const top = colHeights[minCol];
        newPositions.set(item._id, { top, left, width: colWidth, height });
        colHeights[minCol] = top + height + gap;
      }

      positionsRef.current = newPositions;
      setPositions(new Map(newPositions));
      setContainerHeight(Math.max(...colHeights, 0));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [items]);

  // Recalculate when images finish loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const images = container.querySelectorAll("img");
    const pending = { count: 0 };
    const recalc = () => {
      const containerWidth = container.offsetWidth;
      const cols = getColumnCount(containerWidth);
      const gap = getGap(containerWidth);
      const colWidth = (containerWidth - gap * (cols - 1)) / cols;
      const colHeights = new Array(cols).fill(0);
      const newPositions = new Map<string, CardPos>();
      for (const item of items) {
        let minCol = 0;
        for (let c = 1; c < cols; c++) {
          if (colHeights[c] < colHeights[minCol]) minCol = c;
        }
        const el = cardRefs.current.get(item._id);
        const height = el?.offsetHeight || 0;
        const left = minCol * (colWidth + gap);
        const top = colHeights[minCol];
        newPositions.set(item._id, { top, left, width: colWidth, height });
        colHeights[minCol] = top + height + gap;
      }
      positionsRef.current = newPositions;
      setPositions(new Map(newPositions));
      setContainerHeight(Math.max(...colHeights, 0));
    };
    const onLoad = () => {
      pending.count--;
      if (pending.count <= 0) recalc();
    };
    images.forEach((img) => {
      if (!(img as HTMLImageElement).complete) {
        pending.count++;
        img.addEventListener("load", onLoad, { once: true });
        img.addEventListener("error", onLoad, { once: true });
      }
    });
    return () => {
      images.forEach((img) => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onLoad);
      });
    };
  }, [items]);

  // Real-time poll: refresh page 1 periodically so new publications appear immediately.
  // Pauses when the tab is hidden to save bandwidth.
  useEffect(() => {
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const POLL_MS = 10_000;

    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const res = await fetch("/api/inspiration?page=1");
        if (!res.ok) return;
        const data = await res.json();
        if (data.items?.length) {
          // Detect change by comparing first item id and total
          const firstId = data.items[0]?._id;
          const currentFirstId = modItems?.[0]?._id;
          const totalChanged = typeof data.total === "number" && data.total !== modItems?.length;
          if (firstId !== currentFirstId || totalChanged) {
            modItems = data.items;
            modPage = 1;
            renderedIdsRef.current.clear();
            cardRefs.current.clear();
            setItems(data.items);
            setPage(1);
            if (typeof data.total === "number") setTotal(data.total);
          }
        }
      } finally {
        pending = false;
      }
    }

    function tick() {
      refresh();
      timer = setTimeout(tick, POLL_MS);
    }

    // Start when visible, pause/resume with visibility
    function onVisibility() {
      if (document.visibilityState === "visible") {
        refresh(); // immediate refresh on tab switch
        if (!timer) timer = setTimeout(tick, POLL_MS);
      } else {
        if (timer) { clearTimeout(timer); timer = null; }
      }
    }

    if (document.visibilityState === "visible") {
      refresh(); // immediate refresh on mount
      timer = setTimeout(tick, POLL_MS);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Prefetch visible cards
  useLayoutEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-item-id");
            if (id) router.prefetch(`/inspiration/${id}`);
          }
        }
      },
      { rootMargin: "200px" }
    );
    for (const [id, el] of cardRefs.current) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [router, items]);

  // Restore scroll position when returning from detail page
  // Depends on containerHeight — only restores AFTER masonry calculates positions
  const scrollRestoredRef = useRef(false);
  const prevItemsLenRef = useRef(0);
  const prevHeightRef = useRef(0);
  const [scrollReady, setScrollReady] = useState(false);
  useEffect(() => {
    // Reset guard when items or containerHeight change (e.g. load more, masonry recalc)
    // so scroll can be restored again with the new layout
    if (prevItemsLenRef.current !== items.length || prevHeightRef.current !== containerHeight) {
      prevItemsLenRef.current = items.length;
      prevHeightRef.current = containerHeight;
      scrollRestoredRef.current = false;
    }
    if (scrollRestoredRef.current) return;
    const saved = sessionStorage.getItem("inspiration-scroll");
    if (saved === null) {
      scrollRestoredRef.current = true;
      setScrollReady(true);
      return;
    }
    if (containerHeight === 0) return; // wait for masonry to calculate positions
    scrollRestoredRef.current = true;
    const scrollTarget = Number(saved);
    const mainEl = document.querySelector("main");
    if (!mainEl) return;
    mainEl.scrollTop = scrollTarget;
    sessionStorage.removeItem("inspiration-scroll");
    setScrollReady(true);
  }, [containerHeight, items.length]);

  // Return animation — only after scroll is restored so card positions are correct
  useEffect(() => {
    if (!scrollReady) return;
    const raw = sessionStorage.getItem("inspiration-return-anim");
    if (!raw) return;
    sessionStorage.removeItem("inspiration-return-anim");
    try {
      const { id, top, left, width, height } = JSON.parse(raw);
      const item = items.find((it) => it._id === id);
      if (!item) return;
      const tryAnimate = () => {
        const el = cardRefs.current.get(id);
        if (!el) return;
        const target = el.getBoundingClientRect();
        if (target.width === 0 || target.height === 0) {
          requestAnimationFrame(tryAnimate);
          return;
        }
        const natural = { top: target.top, left: target.left, width: target.width, height: target.height };
        returnAnimIdRef.current = null;
        document.body.removeAttribute("data-return"); // CSS hiding no longer needed, returnAnim state takes over
        setReturnAnim({ id, item, from: { top, left, width, height }, to: natural, phase: "positioning" });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setReturnAnim((prev) => prev ? { ...prev, phase: "animating" } : null);
          });
        });
      };
      requestAnimationFrame(() => requestAnimationFrame(tryAnimate));
    } catch {}
  }, [scrollReady, items]);

  function handleCardClick(item: InspirationItem, e: React.MouseEvent) {
    const card = (e.target as HTMLElement).closest("[data-card]");
    if (card) {
      const rect = card.getBoundingClientRect();
      sessionStorage.setItem("inspiration-card-anim", JSON.stringify({
        src: toProxyUrl(item.image_url),
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }));
    }
    // Persist page number for restoration on back-navigation
    persistPage(page);
    // Save scroll container position for restoration on return
    const mainEl = document.querySelector("main");
    if (mainEl) {
      sessionStorage.setItem("inspiration-scroll", String(mainEl.scrollTop));
    }
    startTransition(() => {
      router.push(`/inspiration/${item._id}`, { scroll: false });
    });
  }

  function handleCardHover(item: InspirationItem) {
    router.prefetch(`/inspiration/${item._id}`);
  }

  async function handleCardLike(e: React.MouseEvent, item: InspirationItem) {
    e.stopPropagation();
    if (!currentUserId) {
      toast.error("请先登录");
      return;
    }
    if (likingIds.has(item._id)) return;

    setLikingIds((prev) => new Set(prev).add(item._id));
    setAnimatingIds((prev) => new Set(prev).add(item._id));
    setTimeout(() => {
      setAnimatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }, 400);
    const wasLiked = item.user_liked ?? false;
    const newCount = wasLiked ? (item.likes_count || 1) - 1 : (item.likes_count || 0) + 1;
    setItems((prev) => {
      const next = prev.map((it) =>
        it._id === item._id ? { ...it, user_liked: !wasLiked, likes_count: newCount } : it
      );
      syncMod(next, modPage);
      return next;
    });
    try {
      const res = await fetch(`/api/inspiration/${item._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems((prev) => {
        const next = prev.map((it) =>
          it._id === item._id ? { ...it, user_liked: data.liked, likes_count: data.likes_count } : it
        );
        syncMod(next, modPage);
        return next;
      });
    } catch {
      setItems((prev) => {
        const next = prev.map((it) =>
          it._id === item._id ? { ...it, user_liked: wasLiked, likes_count: item.likes_count || 0 } : it
        );
        syncMod(next, modPage);
        return next;
      });
      toast.error("操作失败，请重试");
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  }

  const hasMore = total > 0 && items.length < total;

  // Persist only page number so it survives back-navigation remount
  const persistPage = useCallback((currentPage: number) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(currentPage));
    } catch {}
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/inspiration?page=${page + 1}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const newPage = page + 1;
      setItems((prev) => {
        const next = [...prev, ...data.items];
        syncMod(next, newPage);
        return next;
      });
      setPage(newPage);
      persistPage(newPage);
    } catch {
      toast.error("加载失败，请重试");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="px-6 py-6 md:px-12 lg:px-20">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
              灵感大厅
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              发现属于你的提示词
            </p>
          </div>
          <Link href="/generate">
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Palette className="mr-1.5 size-4" />
              AI绘画
            </Button>
          </Link>
        </div>

        {/* Masonry Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-violet-500" />
            <span className="ml-3 text-gray-500">加载中...</span>
          </div>
        ) : items.length > 0 ? (
          <div ref={containerRef} className="relative w-full" style={{ height: containerHeight || undefined }}>
            {items.map((item) => {
              const pos = positions.get(item._id);
              return (
                <div
                  key={item._id}
                  ref={(el) => cardRefCallback(item._id, el)}
                  role="button"
                  tabIndex={0}
                  onMouseEnter={() => handleCardHover(item)}
                  onClick={(e) => handleCardClick(item, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/inspiration/${item._id}`, { scroll: false });
                    }
                  }}
                  data-card
                  data-item-id={item._id}
                  className="absolute cursor-pointer"
                  style={pos ? {
                    top: pos.top,
                    left: pos.left,
                    width: pos.width,
                    visibility: (returnAnim?.id === item._id || returnAnimIdRef.current === item._id) ? "hidden" : "visible",
                  } : { visibility: "hidden" }}
                >
                  <div className="group relative overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                    <img
                      src={toProxyUrl(item.image_url)}
                      alt={item.prompt}
                      loading="lazy"
                      decoding="async"
                      className="w-full block object-cover"
                      style={item.width && item.height ? { aspectRatio: `${item.width}/${item.height}` } : undefined}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <div className="absolute bottom-0 left-0 max-w-[70%] p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <p className="truncate text-xs font-medium text-white drop-shadow-md">
                        {item.title || truncate(item.prompt, 20)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleCardLike(e, item)}
                      disabled={likingIds.has(item._id)}
                      className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs opacity-0 transition-all duration-200 group-hover:opacity-100 disabled:opacity-70 ${
                        item.user_liked
                          ? "text-red-500"
                          : "text-white hover:text-red-500"
                      }`}
                    >
                      <Heart className={`size-3.5 transition-transform ${animatingIds.has(item._id) ? "animate-heart" : ""} ${item.user_liked ? "fill-red-500" : ""}`} />
                      <span>{item.likes_count || 0}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ImageIcon className="mb-4 size-12" />
            <p className="text-sm">暂无灵感作品</p>
            <Link href="/generate" className="mt-4">
              <Button>去创作</Button>
            </Link>
          </div>
        )}

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              className="min-w-[140px]"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  加载中...
                </>
              ) : (
                "加载更多"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Return animation clone */}
      {returnAnim && createPortal(
        <div
          style={{
            position: "fixed",
            top: returnAnim.phase === "positioning" ? returnAnim.from.top : returnAnim.to.top,
            left: returnAnim.phase === "positioning" ? returnAnim.from.left : returnAnim.to.left,
            width: returnAnim.phase === "positioning" ? returnAnim.from.width : returnAnim.to.width,
            height: returnAnim.phase === "positioning" ? returnAnim.from.height : returnAnim.to.height,
            zIndex: 9999,
            overflow: "hidden",
            borderRadius: "0.5rem",
            transition: returnAnim.phase === "animating"
              ? "all 0.35s cubic-bezier(0.2, 0, 0, 1)"
              : "none",
          }}
          onTransitionEnd={() => setReturnAnim(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toProxyUrl(returnAnim.item.image_url)}
            alt={returnAnim.item.prompt}
            className="w-full h-full block object-cover"
          />
        </div>,
        document.body
      )}
    </div>
  );
}
