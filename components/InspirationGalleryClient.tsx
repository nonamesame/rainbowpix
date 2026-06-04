"use client";

import { useState, useRef, useLayoutEffect, useCallback, useEffect, startTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Palette, Heart, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toProxyUrl } from "@/lib/image-url";
import type { InspirationItem } from "@/lib/inspiration";

// 延迟加载图片的占位符
const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23f3f4f6' width='200' height='150'/%3E%3Cpath d='M80 65 L100 45 L120 65 L140 50 L160 65 L160 100 L40 100 L40 65 Z' fill='%23d1d5db'/%3E%3Ccircle cx='70' cy='55' r='10' fill='%23d1d5db'/%3E%3C/svg%3E";

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
const STORAGE_FIRST_ID_KEY = "inspiration-gallery-first-id";

// Module-level store: survives React component remounts caused by RSC reconciliation.
// Without this, each remount resets useState to initialItems, losing loaded-more data.
let modItems: InspirationItem[] | null = null;
let modPage = 1;
let modTotal = 0; // 跟踪 total，确保 page refresh 后恢复

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

  // Initialize module store from server data on first load.
  // On Fast Refresh remount, modItems is null — detect and re-fetch if needed.
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
  const [imageLoadStatus, setImageLoadStatus] = useState<Map<string, 'loading' | 'loaded' | 'error'>>(new Map());

  // Persist lightweight fingerprint to sessionStorage (page count + first item ID)
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(modPage));
      if (items.length > 0) {
        sessionStorage.setItem(STORAGE_FIRST_ID_KEY, items[0]._id);
      }
    } catch {}
  }, [items]);
  const router = useRouter();

  const [page, setPage] = useState(modPage);

  // Recover from Fast Refresh remount: if first item doesn't match cached fingerprint,
  // we lost data — re-fetch pages 2..N to restore.
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;
    if (savedPageCount <= 1 || !savedFirstId) return;
    if (items.length > 0 && items[0]._id === savedFirstId) return; // data intact
    (async () => {
      try {
        const pageNumbers = Array.from({ length: savedPageCount - 1 }, (_, i) => i + 2);
        const results = await Promise.all(
          pageNumbers.map((p) => fetch(`/api/inspiration?page=${p}`).then((r) => r.json()))
        );
        const allExtra = results.flatMap((r) => r.items || []);
        const seen = new Set(items.map((it) => it._id));
        const fresh = allExtra.filter((it: InspirationItem) => {
          if (seen.has(it._id)) return false;
          seen.add(it._id);
          return true;
        });
        if (fresh.length > 0) {
          const merged = [...items, ...fresh];
          modItems = merged;
          modPage = savedPageCount;
          setItems(merged);
          setPage(savedPageCount);
        }
      } catch {}
    })();
  }, []);

  // 当 initialItems 为空时（EdgeOne Pages / CloudBase），通过 API 获取数据
  useEffect(() => {
    if (initialItems.length > 0 || items.length > 0) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/inspiration?page=1");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (data.items?.length) {
          modItems = data.items;
          modPage = 1;
          setItems(data.items);
          // 从 API 响应同步 total
          if (typeof data.total === "number") {
            setTotal(data.total);
            modTotal = data.total;
          }
        }
        setLoading(false);
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
    // Persist page count so it survives Fast Refresh remounts
    if (newPage > 1) {
      try { sessionStorage.setItem(STORAGE_KEY, String(newPage)); } catch {}
    }
  }, []);

  // If returning from detail with more pages loaded, re-fetch them.
  // Also handles Fast Refresh remounts where modItems gets reset.
  // Uses module-level modItems to survive RSC remounts.
  useEffect(() => {
    const targetPage = savedPage.current;
    if (!targetPage || targetPage <= 1) return;
    savedPage.current = null;

    (async () => {
      try {
        // 同时获取 page 1 和 pages 2..N，确保 total 也被更新
        const pageNumbers = [1, ...Array.from({ length: targetPage - 1 }, (_, i) => i + 2)];
        const results = await Promise.all(
          pageNumbers.map((p) => fetch(`/api/inspiration?page=${p}`).then((r) => r.json()))
        );

        // 从 page 1 响应获取 total
        const page1Data = results[0];
        if (typeof page1Data?.total === "number") {
          setTotal(page1Data.total);
          modTotal = page1Data.total;
        }

        // 合并所有页面数据
        const allItems = results.flatMap((r) => r.items || []);
        if (allItems.length > 0) {
          // 去重后合并
          const seen = new Set<string>();
          const merged = allItems.filter((it: InspirationItem) => {
            if (seen.has(it._id)) return false;
            seen.add(it._id);
            return true;
          });
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

  const [total, setTotal] = useState(modTotal || initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);

  // 确保 total 一定有值：如果 modItems 有数据但 total 还是 0，请求 page 1 获取 count
  useEffect(() => {
    if (total > 0 || items.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/inspiration?page=1");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (typeof data.total === "number") {
          setTotal(data.total);
          modTotal = data.total;
        }
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [total, items.length]);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
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
  const renderedIdsRef = useRef<Set<string>>(new Set());
  const [positions, setPositions] = useState<Map<string, CardPos>>(new Map());
  const [containerHeight, setContainerHeight] = useState(0);

  // 统一的布局计算函数
  const recalculateLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;

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
      const height = el?.offsetHeight || 200; // 默认高度 200px
      const left = minCol * (colWidth + gap);
      const top = colHeights[minCol];
      newPositions.set(item._id, { top, left, width: colWidth, height });
      colHeights[minCol] = top + height + gap;
    }

    positionsRef.current = newPositions;
    setPositions(new Map(newPositions));
    setContainerHeight(Math.max(...colHeights, 0));
  }, [items]);

  // Ref callback: sync position into ref
  const cardRefCallback = useCallback((id: string, el: HTMLDivElement | null) => {
    if (!el) {
      cardRefs.current.delete(id);
      return;
    }
    cardRefs.current.set(id, el);
    // 每次有新的 ref 就重新计算布局
    requestAnimationFrame(() => recalculateLayout());
  }, [recalculateLayout]);

  // 当 items 变化时，清空 refs 并重新计算
  useEffect(() => {
    cardRefs.current.clear();
    // 等待 DOM 更新后重新计算
    const timer = setTimeout(() => recalculateLayout(), 0);
    return () => clearTimeout(timer);
  }, [items, recalculateLayout]);

  // ResizeObserver — recalculate on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      recalculateLayout();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [recalculateLayout]);

  // Recalculate when images finish loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 监听所有图片的 load 和 error 事件
    const images = container.querySelectorAll("img");
    const handlers: Array<{ img: HTMLImageElement; handler: () => void }> = [];

    images.forEach((img) => {
      const imgEl = img as HTMLImageElement;
      if (!imgEl.complete) {
        const handler = () => recalculateLayout();
        imgEl.addEventListener("load", handler, { once: true });
        imgEl.addEventListener("error", handler, { once: true });
        handlers.push({ img: imgEl, handler });
      }
    });

    return () => {
      handlers.forEach(({ img, handler }) => {
        img.removeEventListener("load", handler);
        img.removeEventListener("error", handler);
      });
    };
  }, [items, recalculateLayout]);

  // Real-time poll: refresh page 1 periodically so new publications appear immediately.
  // Only runs when user hasn't scrolled past page 1 (avoids resetting loaded items).
  // Pauses when the tab is hidden to save bandwidth.
  useEffect(() => {
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const POLL_MS = 60_000;

    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      if (modPage > 1) return;
      pending = true;
      try {
        const res = await fetch("/api/inspiration?page=1");
        if (!res.ok) return;
        const data = await res.json();
        if (data.items?.length) {
          const firstId = data.items[0]?._id;
          const currentFirstId = modItems?.[0]?._id;
          if (firstId !== currentFirstId) {
            modItems = data.items;
            modPage = 1;
            renderedIdsRef.current.clear();
            cardRefs.current.clear();
            setItems(data.items);
            setPage(1);
            if (typeof data.total === "number") {
              setTotal(data.total);
              modTotal = data.total;
            }
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

    function onVisibility() {
      if (document.visibilityState === "visible") {
        refresh();
        if (!timer) timer = setTimeout(tick, POLL_MS);
      } else {
        if (timer) { clearTimeout(timer); timer = null; }
      }
    }

    if (document.visibilityState === "visible") {
      refresh();
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

  // Restore scroll position when returning from detail page.
  // Uses a one-shot guard (returnScrollDoneRef) that is NEVER reset by loadMore —
  // only the sessionStorage check determines whether to restore.
  const returnScrollDoneRef = useRef(false);
  const [scrollReady, setScrollReady] = useState(false);
  useEffect(() => {
    if (returnScrollDoneRef.current) return;
    const saved = sessionStorage.getItem("inspiration-scroll");
    if (saved === null) {
      // No saved position — nothing to restore (normal loadMore / first visit)
      returnScrollDoneRef.current = true;
      setScrollReady(true);
      return;
    }
    if (containerHeight === 0) return; // wait for masonry to calculate positions
    returnScrollDoneRef.current = true;
    const scrollTarget = Number(saved);
    const mainEl = document.querySelector("main");
    if (!mainEl) return;
    mainEl.scrollTop = scrollTarget;
    sessionStorage.removeItem("inspiration-scroll");
    setScrollReady(true);
  }, [containerHeight]);

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
      // Clean up any stale large keys that might fill sessionStorage
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k !== STORAGE_KEY && k !== STORAGE_FIRST_ID_KEY
              && k !== "inspiration-scroll" && k !== "inspiration-return-anim"
              && k !== "inspiration-card-anim" && k !== "theme"
              && !k.startsWith("announcement_shown_")) {
            sessionStorage.removeItem(k);
          }
        }
      } catch {}
      try {
        sessionStorage.setItem("inspiration-card-anim", JSON.stringify({
          src: toProxyUrl(item.image_url),
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }));
      } catch {}
    }
    // Persist page number for restoration on back-navigation
    persistPage(page);
    // Save scroll container position for restoration on return
    const mainEl = document.querySelector("main");
    if (mainEl) {
      try { sessionStorage.setItem("inspiration-scroll", String(mainEl.scrollTop)); } catch {}
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
      if (data.liked) window.dispatchEvent(new Event("task-action"));
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

  const loadingRef = useRef(false);
  async function loadMore() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/inspiration?page=${page + 1}`);
      if (res.status === 429) {
        toast.error("加载太快了，稍后再试");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      const newPage = page + 1;

      // 从 API 响应同步 total（防止 total 过期导致提前到底）
      if (typeof data.total === "number") {
        setTotal(data.total);
        modTotal = data.total;
      }

      const newIds = new Set<string>((data.items || []).map((it: InspirationItem) => it._id));
      setNewItemIds(newIds);
      setTimeout(() => setNewItemIds(new Set()), 500);
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
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }

  // Infinite scroll: sentinel triggers loadMore when near viewport
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current) {
          // Debounce: wait 300ms after becoming visible before loading
          // 稍微增加延迟，避免快速滚动时频繁加载
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => loadMore(), 300);
        }
      },
      { root: document.querySelector("main"), rootMargin: "400px" }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [page, hasMore]);

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
            <Button className="bg-brand hover:bg-brand-dark">
              <Palette className="mr-1.5 size-4" />
              AI绘画
            </Button>
          </Link>
        </div>

        {/* Masonry Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-brand" />
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
                  className="absolute cursor-pointer animate-fadein"
                  style={pos ? {
                    top: pos.top,
                    left: pos.left,
                    width: pos.width,
                    visibility: (returnAnim?.id === item._id || returnAnimIdRef.current === item._id) ? "hidden" : "visible",
                  } : { visibility: "hidden" }}
                >
                  <div className="group relative overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                    {/* 图片加载状态指示器 */}
                    {imageLoadStatus.get(item._id) !== 'loaded' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                        <Loader2 className="size-6 animate-spin text-gray-300" />
                      </div>
                    )}
                    <img
                      src={toProxyUrl(item.image_url)}
                      alt={item.prompt}
                      loading="lazy"
                      decoding="async"
                      className={`w-full block object-cover ${
                        imageLoadStatus.get(item._id) === 'loaded' ? 'animate-image-fadein' : 'opacity-0'
                      }`}
                      style={item.width && item.height ? { aspectRatio: `${item.width}/${item.height}` } : undefined}
                      onLoad={() => {
                        setImageLoadStatus(prev => new Map(prev).set(item._id, 'loaded'));
                        // 图片加载完成后重新计算布局
                        requestAnimationFrame(() => recalculateLayout());
                      }}
                      onError={(e) => {
                        setImageLoadStatus(prev => new Map(prev).set(item._id, 'error'));
                        // 使用更好的错误占位符
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23fef2f2' width='200' height='150'/%3E%3Cpath d='M80 65 L100 45 L120 65 L140 50 L160 65 L160 100 L40 100 L40 65 Z' fill='%23fca5a5'/%3E%3Ccircle cx='70' cy='55' r='10' fill='%23fca5a5'/%3E%3Ctext x='100' y='120' text-anchor='middle' fill='%23dc2626' font-size='12'%3E加载失败%3C/text%3E%3C/svg%3E";
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

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-8">
            {loadingMore && <Loader2 className="size-6 animate-spin text-gray-400" />}
          </div>
        )}

        {/* 只有 total > 0 时才显示"到底了"，total 为 0 说明还没获取到总数 */}
        {!hasMore && items.length > 0 && total > 0 && (
          <p className="py-8 text-center text-xs text-gray-400">— 已经到底了 —</p>
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
