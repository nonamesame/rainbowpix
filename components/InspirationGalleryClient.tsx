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

export default function InspirationGalleryClient({
  initialItems,
  total: initialTotal,
  currentUserId,
}: Props) {
  const [items, setItems] = useState<InspirationItem[]>(initialItems);
  const router = useRouter();

  const [page, setPage] = useState(1);
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

  // Reset rendered IDs when items change (new items added via load more)
  useEffect(() => {
    // Only clear IDs for items that are NEW (not in previous set)
    const newIds = items.filter((it) => !renderedIdsRef.current.has(it._id)).map((it) => it._id);
    if (newIds.length > 0) {
      // Don't clear — just let the new items' ref callbacks run
      // The allReady check will handle it
    }
  }, [items]);

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

  // Return animation
  useEffect(() => {
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
        setReturnAnim({ id, item, from: { top, left, width, height }, to: natural, phase: "positioning" });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setReturnAnim((prev) => prev ? { ...prev, phase: "animating" } : null);
          });
        });
      };
      requestAnimationFrame(() => requestAnimationFrame(tryAnimate));
    } catch {}
  }, [items]);

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
    setItems((prev) =>
      prev.map((it) =>
        it._id === item._id ? { ...it, user_liked: !wasLiked, likes_count: newCount } : it
      )
    );
    try {
      const res = await fetch(`/api/inspiration/${item._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems((prev) =>
        prev.map((it) =>
          it._id === item._id ? { ...it, user_liked: data.liked, likes_count: data.likes_count } : it
        )
      );
    } catch {
      setItems((prev) =>
        prev.map((it) =>
          it._id === item._id ? { ...it, user_liked: wasLiked, likes_count: item.likes_count || 0 } : it
        )
      );
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

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/inspiration?page=${page + 1}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setPage((p) => p + 1);
    } catch {
      toast.error("加载失败，请重试");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="min-h-screen">
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
        {items.length > 0 ? (
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
                    visibility: returnAnim?.id === item._id ? "hidden" : "visible",
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
