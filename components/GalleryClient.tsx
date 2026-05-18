"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { models } from "@/lib/models";
import { toProxyUrl } from "@/lib/image-url";

interface Generation {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  created_at: string;
}

interface Props {
  initialItems: Generation[];
  total: number;
}

const PAGE_SIZE = 12;

function getModelName(modelId: string) {
  return models.find((m) => m.id === modelId)?.name || modelId;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export default function GalleryClient({ initialItems, total }: Props) {
  const [items, setItems] = useState<Generation[]>(initialItems);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Generation | null>(null);

  const hasMore = items.length < total;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/gallery?page=${page + 1}`);
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

  async function handleDownload(item: Generation) {
    try {
      const res = await fetch(toProxyUrl(item.image_url));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-${item.id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("下载失败");
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/30">
        <div className="px-6 py-6">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">我的画廊</h1>
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ImageOff className="mb-4 size-12" />
            <p className="text-sm">还没有生成过图片</p>
            <Button
              className="mt-4"
              onClick={() => (window.location.href = "/generate")}
            >
              去生成
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/30">
      <div className="px-6 py-6">
        <div className="mb-6 flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-gray-900">我的画廊</h1>
          <span className="text-sm text-gray-400">{total} 张</span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="group cursor-pointer rounded-2xl bg-white p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
              <p className="mt-2 truncate text-xs text-gray-600">
                {truncate(item.prompt, 50)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                  {getModelName(item.model)}
                </span>
                <span className="text-[10px] text-gray-400">
                  {formatDate(item.created_at)}
                </span>
              </div>
            </button>
          ))}
        </div>

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

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>图片详情</DialogTitle>
                <DialogDescription>{formatDate(selected.created_at)}</DialogDescription>
              </DialogHeader>

              <div className="relative overflow-hidden rounded-xl bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toProxyUrl(selected.image_url)}
                  alt={selected.prompt}
                  className="w-full object-contain"
                />
                {/* Watermark */}
                <span className="pointer-events-none absolute bottom-2 right-2 select-none rounded bg-black/30 px-2 py-0.5 text-xs text-white/70 backdrop-blur-sm">
                  RainbowPix
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">提示词：</span>
                  <span className="text-gray-600">{selected.prompt}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">模型：</span>
                  <span className="text-gray-600">{getModelName(selected.model)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => handleDownload(selected)}>
                  <Download className="mr-1.5 size-4" />
                  下载图片
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
