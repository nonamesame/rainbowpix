"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Download, Trash2, Loader2, ImageOff, Eye, Share2, Copy } from "lucide-react";
import ImageViewer from "@/components/ImageViewer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { models, getModelName } from "@/lib/models";
import { toProxyUrl } from "@/lib/image-url";

interface Generation {
  _id: string;
  prompt: string;
  model: string;
  image_url: string;
  reference_image_url?: string;
  created_at: string;
  published?: boolean;
  width?: number;
  height?: number;
}

interface Props {
  initialItems: Generation[];
  total: number;
  user?: { uid: string; email?: string };
}

const PAGE_SIZE = 12;

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

export default function GalleryClient({ initialItems, total: initialTotal }: Props) {
  const [items, setItems] = useState<Generation[]>(initialItems);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal >= 0 ? initialTotal : items.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Generation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRefImage, setShowRefImage] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);

  // Poll task API for new generation while pending on the generate page
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function checkPending() {
      try {
        const raw = localStorage.getItem("rainbowpix_generate_state");
        if (!raw) return null;
        const state = JSON.parse(raw);
        if (!state.pending || state.result) return null;
        return state.pending;
      } catch {
        return null;
      }
    }

    const pending = checkPending();
    if (!pending?.taskId) return;

    let done = false;

    async function poll() {
      if (done) return;
      try {
        const res = await fetch(`/api/task/${pending.taskId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "completed") {
          // 从 generations 查询完整数据
          const genRes = await fetch(`/api/gallery?page=1&prompt=${encodeURIComponent(pending.prompt)}`);
          if (genRes.ok) {
            const genData = await genRes.json();
            const match = genData.items?.find(
              (item: { prompt: string; model: string }) =>
                item.prompt === pending.prompt && item.model === pending.model
            );
            if (match && !items.some((i) => i._id === match._id)) {
              setItems((prev) => [match, ...prev]);
              setTotal((t) => (t < 0 ? t : t + 1));
            }
          }
          toast.success("新图片已生成");
          try {
            const raw = localStorage.getItem("rainbowpix_generate_state");
            if (raw) {
              const state = JSON.parse(raw);
              state.pending = null;
              localStorage.setItem("rainbowpix_generate_state", JSON.stringify(state));
            }
          } catch {}
          done = true;
          if (timer) clearInterval(timer);
        } else if (data.status === "failed") {
          toast.error(data.error || "生成失败");
          try {
            const raw = localStorage.getItem("rainbowpix_generate_state");
            if (raw) {
              const state = JSON.parse(raw);
              state.pending = null;
              localStorage.setItem("rainbowpix_generate_state", JSON.stringify(state));
            }
          } catch {}
          done = true;
          if (timer) clearInterval(timer);
        }
      } catch {}
    }

    timer = setInterval(poll, 2000);
    poll();

    return () => {
      done = true;
      if (timer) clearInterval(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore = total < 0 ? false : items.length < total;

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

  function handleCopyPrompt(prompt: string) {
    navigator.clipboard.writeText(prompt).then(() => {
      toast.success("已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败");
    });
  }

  async function handleDownload(item: Generation) {
    try {
      const res = await fetch(toProxyUrl(item.image_url));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-${item._id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("下载失败");
    }
  }

  async function handleDelete(item: Generation, skipConfirm = false) {
    if (!skipConfirm && !confirm("确定要删除这张图片吗？")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/gallery/${item._id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || `删除失败 (${res.status})`);
      }
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setSelected(null);
      toast.success("删除成功");
    } catch (e: any) {
      toast.error(e?.message || "删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  }

  function openPublishDialog(item: Generation) {
    setPublishTitle("");
    setWatermarkEnabled(false);
    setSelected(item);
    setShowPublishDialog(true);
  }

  async function handlePublish(item: Generation) {
    setPublishing(true);
    try {
      const res = await fetch(`/api/inspiration/${item._id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          published: true,
          title: publishTitle.trim() || item.prompt,
          watermark_enabled: watermarkEnabled,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || `发布失败 (${res.status})`);
      }
      setItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, published: true } : i))
      );
      setSelected((prev) => (prev?._id === item._id ? { ...prev, published: true } : prev));
      setShowPublishDialog(false);
      toast.success("发布成功");
      window.dispatchEvent(new Event("task-action"));
    } catch (e: any) {
      toast.error(e?.message || "发布失败，请重试");
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish(item: Generation) {
    if (!confirm("确定要取消发布吗？")) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/inspiration/${item._id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || `操作失败 (${res.status})`);
      }
      setItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, published: false } : i))
      );
      setSelected((prev) => (prev?._id === item._id ? { ...prev, published: false } : prev));
      toast.success("已取消发布");
    } catch (e: any) {
      toast.error(e?.message || "操作失败，请重试");
    } finally {
      setPublishing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="px-4 py-6 md:px-6">
          <h1 className="mb-6 text-xl font-bold text-gray-900 md:text-2xl">我的画廊</h1>
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
    <div className="min-h-screen">
      <div className="px-4 py-6 md:px-6">
        <div className="mb-6 flex items-baseline gap-2">
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">我的画廊</h1>
          <span className="text-sm text-gray-400">{total < 0 ? "加载中..." : `${total} 张`}</span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
          {items.map((item) => (
            <div
              key={item._id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(item)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(item); } }}
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
                {item.published && (
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brand/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    <Share2 className="size-2.5" />
                    已发布
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item);
                  }}
                  className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <p className="mt-1.5 truncate text-xs text-gray-600 md:mt-2">
                {truncate(item.prompt, 20)}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                  {getModelName(item.model)}
                </span>
              </div>
            </div>
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
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setShowRefImage(false); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>图片详情</DialogTitle>
                <DialogDescription>{formatDate(selected.created_at)}</DialogDescription>
              </DialogHeader>

              <div
                className="relative max-h-[60vh] cursor-pointer overflow-hidden rounded-xl bg-gray-100"
                onClick={() => setFullscreen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toProxyUrl(selected.image_url)}
                  alt={selected.prompt}
                  className="mx-auto max-h-[60vh] object-contain"
                />
                {/* Watermark */}
                <span className="pointer-events-none absolute bottom-2 right-2 select-none rounded bg-black/30 px-2 py-0.5 text-xs text-white/70 backdrop-blur-sm">
                  RainbowPix
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-1">
                  <span className="shrink-0 font-medium text-gray-700">提示词：</span>
                  <div className="flex-1 max-h-[15vh] overflow-y-auto overscroll-contain">
                    <span className="text-gray-600 break-all text-xs leading-relaxed">{selected.prompt}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(selected.prompt)}
                    className="flex shrink-0 items-center justify-center rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="复制提示词"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
                {selected.reference_image_url && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">参考图：</span>
                    <button
                      type="button"
                      onClick={() => setShowRefImage(true)}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-light px-2 py-1 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-light"
                    >
                      <Eye className="size-3.5" />
                      查看参考图
                    </button>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">模型：</span>
                  <span className="text-gray-600">{getModelName(selected.model)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selected, true)}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 size-4" />
                  )}
                  删除
                </Button>
                <Button onClick={() => handleDownload(selected)}>
                  <Download className="mr-1.5 size-4" />
                  下载图片
                </Button>
                {selected.published ? (
                  <Button
                    variant="outline"
                    onClick={() => handleUnpublish(selected)}
                    disabled={publishing}
                  >
                    {publishing ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Share2 className="mr-1.5 size-4" />
                    )}
                    取消发布
                  </Button>
                ) : (
                  <Button
                    onClick={() => openPublishDialog(selected)}
                    disabled={publishing}
                  >
                    <Share2 className="mr-1.5 size-4" />
                    发布到灵感大厅
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reference image dialog */}
      <Dialog open={showRefImage} onOpenChange={(open) => { if (!open) setShowRefImage(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>参考图</DialogTitle>
          </DialogHeader>
          {selected?.reference_image_url && (
            <div className="space-y-3">
              {(() => {
                let urls: string[] = [];
                try {
                  const parsed = JSON.parse(selected.reference_image_url);
                  if (Array.isArray(parsed)) urls = parsed;
                } catch {
                  urls = [selected.reference_image_url];
                }
                return urls.map((url, i) => (
                  <div key={i} className="overflow-hidden rounded-xl bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={toProxyUrl(url)}
                      alt={`参考图 ${i + 1}`}
                      className="w-full object-contain"
                    />
                  </div>
                ));
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Publish dialog */}
      <Dialog open={showPublishDialog} onOpenChange={(open) => { if (!open) setShowPublishDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>发布到灵感大厅</DialogTitle>
            <DialogDescription>发布后其他用户可以看到并点赞</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                标题（可选）
              </label>
              <input
                type="text"
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                placeholder={selected ? truncate(selected.prompt, 30) : "输入标题"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
              />
            </div>
            {/* 暂时隐藏水印选项
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={watermarkEnabled}
                onChange={(e) => setWatermarkEnabled(e.target.checked)}
                className="size-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              添加水印保护
            </label>
            */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
              取消
            </Button>
            <Button onClick={() => selected && handlePublish(selected)} disabled={publishing}>
              {publishing ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Share2 className="mr-1.5 size-4" />
              )}
              发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-screen image viewer */}
      {fullscreen && selected && (
        <ImageViewer
          src={toProxyUrl(selected.image_url)}
          alt={selected.prompt}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}
