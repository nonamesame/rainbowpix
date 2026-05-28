"use client";

import { useState, useRef, useLayoutEffect, startTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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

  useLayoutEffect(() => {
    const raw = sessionStorage.getItem("inspiration-return-anim");
    if (!raw) return;
    sessionStorage.removeItem("inspiration-return-anim");
    try {
      const { id, top, left, width, height } = JSON.parse(raw);
      const el = cardRefs.current.get(id);
      if (!el) return;
      const target = el.getBoundingClientRect();
      if (target.width === 0 || target.height === 0) return;
      const item = items.find((it) => it._id === id);
      if (!item) return;
      // Save natural position, then hide original card
      const natural = { top: target.top, left: target.left, width: target.width, height: target.height };
      // Phase 1: position clone at detail page location
      setReturnAnim({ id, item, from: { top, left, width, height }, to: natural, phase: "positioning" });
      // Phase 2: after paint, animate clone to natural position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setReturnAnim((prev) => prev ? { ...prev, phase: "animating" } : null);
        });
      });
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
          <div className="columns-2 gap-3 sm:columns-3 md:columns-4 md:gap-4">
            {items.map((item) => (
              <motion.div
                key={item._id}
                ref={(el) => { if (el) cardRefs.current.set(item._id, el); }}
                layoutId={`card-${item._id}`}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                style={returnAnim?.id === item._id ? { visibility: "hidden" } : undefined}
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
                className="mb-3 break-inside-avoid cursor-pointer md:mb-4"
              >
                <div className="group relative overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                  <motion.img
                    layoutId={`image-${item._id}`}
                    src={toProxyUrl(item.image_url)}
                    alt={item.prompt}
                    loading="lazy"
                    decoding="async"
                    className="w-full block"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
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
              </motion.div>
            ))}
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

      {/* Return animation clone — rendered in portal to escape masonry stacking context */}
      {returnAnim && createPortal(
        <div
          style={{
            position: "absolute",
            top: returnAnim.phase === "positioning" ? returnAnim.from.top : returnAnim.to.top,
            left: returnAnim.phase === "positioning" ? returnAnim.from.left : returnAnim.to.left,
            width: returnAnim.phase === "positioning" ? returnAnim.from.width : returnAnim.to.width,
            height: returnAnim.phase === "positioning" ? returnAnim.from.height : returnAnim.to.height,
            zIndex: 9999,
            transition: returnAnim.phase === "animating"
              ? "all 0.35s cubic-bezier(0.2, 0, 0, 1)"
              : "none",
          }}
          onTransitionEnd={() => setReturnAnim(null)}
        >
          <div className="group relative overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={toProxyUrl(returnAnim.item.image_url)}
              alt={returnAnim.item.prompt}
              className="w-full block"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
