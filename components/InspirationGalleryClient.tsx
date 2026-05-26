"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Palette, Heart, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { models } from "@/lib/models";
import { toProxyUrl } from "@/lib/image-url";
import InspirationDetailModal from "./InspirationDetailModal";
import type { InspirationItem } from "@/lib/inspiration";

interface Props {
  initialItems: InspirationItem[];
  total: number;
  currentUserId?: string;
}

const PAGE_SIZE = 12;

function getModelName(modelId: string) {
  return models.find((m) => m.id === modelId)?.name || modelId;
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<InspirationItem | null>(null);

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
      <div className="px-4 py-6 md:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
              灵感大厅
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              发现创作者的精彩作品
            </p>
          </div>
          <Link href="/generate">
            <Button className="bg-[#7c3aed] hover:bg-[#6d28d9]">
              <Palette className="mr-1.5 size-4" />
              AI绘画
            </Button>
          </Link>
        </div>

        {/* Grid */}
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
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
                className="group cursor-pointer rounded-xl bg-white p-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md md:rounded-2xl md:p-3"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                  <img
                    src={toProxyUrl(item.image_url)}
                    alt={item.prompt}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
                <p className="mt-1.5 truncate text-xs text-gray-600 md:mt-2">
                  {item.title || truncate(item.prompt, 15)}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                    {getModelName(item.model)}
                  </span>
                  <button
                    onClick={(e) => handleCardLike(e, item)}
                    className={`flex items-center gap-0.5 text-[10px] transition-colors cursor-pointer hover:text-red-500 ${item.user_liked ? "text-red-500" : "text-gray-400"}`}
                  >
                    <Heart className={`size-3 ${item.user_liked ? "fill-red-500" : ""}`} />
                    {item.likes_count || 0}
                  </button>
                </div>
                <p className="mt-0.5 text-[10px] text-gray-400 truncate">
                  <Link
                    href={`/profile/${item.user_id}`}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-[#7c3aed] transition-colors"
                  >
                    {item.username || "匿名用户"}
                  </Link>
                </p>
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
