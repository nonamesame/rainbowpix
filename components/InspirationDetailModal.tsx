"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Heart, Copy, Sparkles, Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { models } from "@/lib/models";
import { toProxyUrl } from "@/lib/image-url";
import type { InspirationItem } from "@/lib/inspiration";

interface Props {
  item: InspirationItem;
  currentUserId?: string;
  onClose: () => void;
  onLikeToggle: (id: string, liked: boolean, count: number) => void;
}

function getModelName(modelId: string) {
  return models.find((m) => m.id === modelId)?.name || modelId;
}

function parseReferenceImages(ref?: string): string[] {
  if (!ref) return [];
  try {
    const parsed = JSON.parse(ref);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [ref];
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

export default function InspirationDetailModal({
  item,
  currentUserId,
  onClose,
  onLikeToggle,
}: Props) {
  const [liked, setLiked] = useState(item.user_liked || false);
  const [likesCount, setLikesCount] = useState(item.likes_count || 0);
  const [liking, setLiking] = useState(false);
  const [showRefImage, setShowRefImage] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isOwner = currentUserId === item.user_id;
  const hasRefImages = parseReferenceImages(item.reference_image_url).length > 0;

  async function handleLike() {
    if (liking) return;
    if (!currentUserId) {
      toast.error("请先登录");
      return;
    }
    setLiking(true);
    try {
      const res = await fetch(`/api/inspiration/${item._id}/like`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }
      setLiked(data.liked);
      setLikesCount(data.likes_count);
      onLikeToggle(item._id, data.liked, data.likes_count);
    } catch {
      toast.error("操作失败");
    } finally {
      setLiking(false);
    }
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(item.prompt).then(() => {
      toast.success("已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败");
    });
  }

  function handleMakeSame() {
    const params = new URLSearchParams({
      prompt: item.prompt,
      model: item.model,
    });
    window.location.href = `/generate?${params.toString()}`;
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      // Use watermark endpoint for non-owners when watermark is enabled
      let url: string;
      if (!isOwner && item.watermark_enabled) {
        url = `/api/inspiration/${item._id}/watermark`;
      } else {
        url = toProxyUrl(item.image_url);
      }
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `inspiration-${item._id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("下载失败");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{item.title || "作品详情"}</DialogTitle>
            <DialogDescription>
              {item.username || "匿名用户"} · {formatDate(item.created_at)}
            </DialogDescription>
          </DialogHeader>

          {/* Image */}
          <div className="relative overflow-hidden rounded-xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={toProxyUrl(item.image_url)}
              alt={item.prompt}
              className="w-full object-contain"
            />
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-1">
              <span className="font-medium text-gray-700">提示词：</span>
              <span className="flex-1 text-gray-600 break-all">{item.prompt}</span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex shrink-0 items-center justify-center rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="复制提示词"
              >
                <Copy className="size-3.5" />
              </button>
            </div>

            {hasRefImages && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">参考图：</span>
                <button
                  type="button"
                  onClick={() => setShowRefImage(true)}
                  className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"
                >
                  <Eye className="size-3.5" />
                  查看参考图（{parseReferenceImages(item.reference_image_url).length} 张）
                </button>
              </div>
            )}

            <div>
              <span className="font-medium text-gray-700">模型：</span>
              <span className="text-gray-600">{getModelName(item.model)}</span>
            </div>

            {item.watermark_enabled && !isOwner && (
              <div className="text-xs text-gray-400">
                下载图片将包含水印
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={liked ? "default" : "outline"}
              size="sm"
              onClick={handleLike}
              disabled={liking}
              className={liked ? "bg-red-500 hover:bg-red-600 text-white" : ""}
            >
              {liking ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Heart className={`mr-1 size-3.5 ${liked ? "fill-current" : ""}`} />
              )}
              {likesCount}
            </Button>

            <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
              <Copy className="mr-1 size-3.5" />
              复制提示词
            </Button>

            <Button variant="outline" size="sm" onClick={handleMakeSame}>
              <Sparkles className="mr-1 size-3.5" />
              做同款
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Download className="mr-1 size-3.5" />
              )}
              下载
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reference image dialog */}
      <Dialog open={showRefImage} onOpenChange={(open) => { if (!open) setShowRefImage(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>参考图</DialogTitle>
          </DialogHeader>
          {item.reference_image_url && (
            <div className="space-y-3">
              {parseReferenceImages(item.reference_image_url).map((url, i) => (
                <div key={i} className="overflow-hidden rounded-xl bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={toProxyUrl(url)}
                    alt={`参考图 ${i + 1}`}
                    className="w-full object-contain"
                  />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
