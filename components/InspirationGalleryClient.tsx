"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Palette, Heart, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toProxyUrl } from "@/lib/image-url";
import InspirationDetailModal from "./InspirationDetailModal";
import type { InspirationItem } from "@/lib/inspiration";

interface Props {
  initialItems: InspirationItem[];
  total: number;
  currentUserId?: string;
}

const PAGE_SIZE = 12;

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function InspirationGalleryClient({
  initialItems,
  total: initialTotal,
  currentUserId,
}: Props) {
  const [items, setItems] = useState<InspirationItem[]>(initialItems);

  useEffect(() => {
    setItems((prev) => shuffle(prev));
  }, []);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<InspirationItem | null>(null);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  const handleLikeToggle = useCallback((id: string, liked: boolean, count: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item._id === id
          ? { ...item, user_liked: liked, likes_count: count }
          : item
      )
    );
  }, []);

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
    handleLikeToggle(item._id, !wasLiked, newCount);
    try {
      const res = await fetch(`/api/inspiration/${item._id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      handleLikeToggle(item._id, data.liked, data.likes_count);
    } catch {
      handleLikeToggle(item._id, wasLiked, item.likes_count || 0);
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
              <div
                key={item._id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(item);
                  }
                }}
                className="mb-3 break-inside-avoid cursor-pointer md:mb-4"
              >
                    <div className="group relative overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                      <img
                        src={toProxyUrl(item.image_url)}
                        alt={item.prompt}
                        loading="lazy"
                        decoding="async"
                        className="w-full block transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                        }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      {/* Work title - bottom left */}
                      <div className="absolute bottom-0 left-0 max-w-[70%] p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <p className="truncate text-xs font-medium text-white drop-shadow-md">
                          {item.title || truncate(item.prompt, 20)}
                        </p>
                      </div>
                      {/* Like button - right side */}
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

        {/* Load more */}
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

      {/* Detail modal */}
      {selected && (
        <InspirationDetailModal
          item={selected}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
          onLikeToggle={handleLikeToggle}
        />
      )}
    </div>
  );
}
