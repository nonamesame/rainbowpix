"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Heart, Copy, Sparkles, Download, Eye, Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import ImageViewer from "@/components/ImageViewer";
import { useScrollContainer } from "@/components/ScrollContainer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { models, widthHeightToAspectRatio } from "@/lib/models";
import { toProxyUrl } from "@/lib/image-url";
import type { InspirationItem } from "@/lib/inspiration";
import InspirationComments from "./InspirationComments";

interface Props {
  item: InspirationItem;
  currentUserId?: string;
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

export default function InspirationDetailClient({
  item,
  currentUserId,
}: Props) {
  const router = useRouter();
  const scrollContainer = useScrollContainer();
  const [liked, setLiked] = useState(item.user_liked || false);
  const [likesCount, setLikesCount] = useState(item.likes_count || 0);
  const [liking, setLiking] = useState(false);
  const [showRefImage, setShowRefImage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(item.comments_count || 0);
  const [authorStats, setAuthorStats] = useState<{ published_count: number; total_likes: number } | null>(null);
  const [imgAnim, setImgAnim] = useState<{ from: string; transition: string } | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("inspiration-card-anim");
    if (!raw) return;
    sessionStorage.removeItem("inspiration-card-anim");
    try {
      const card = JSON.parse(raw);
      const el = imgRef.current;
      if (!el) return;

      // Wait for image to load so getBoundingClientRect returns correct dimensions
      const imgEl = el.querySelector("img");
      const startAnimation = () => {
        const target = el.getBoundingClientRect();
        if (target.width === 0 || target.height === 0) return;
        const dx = card.left + card.width / 2 - (target.left + target.width / 2);
        const dy = card.top + card.height / 2 - (target.top + target.height / 2);
        const sx = card.width / target.width;
        const sy = card.height / target.height;
        setImgAnim({
          from: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transition: "none",
        });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setImgAnim({
              from: "translate(0px, 0px) scale(1, 1)",
              transition: "transform 0.35s cubic-bezier(0.2, 0, 0, 1)",
            });
          });
        });
      };

      if (imgEl && !imgEl.complete) {
        imgEl.addEventListener("load", startAnimation, { once: true });
      } else {
        // Image cached: wait one frame to ensure layout is computed
        requestAnimationFrame(() => startAnimation());
      }
    } catch {}
  }, []);

  useEffect(() => {
    scrollContainer.scrollTo(0, 0);
  }, [scrollContainer]);

  useEffect(() => {
    fetch(`/api/users/${item.user_id}/stats`)
      .then((r) => r.json())
      .then((data) => setAuthorStats(data))
      .catch(() => {});
  }, [item.user_id]);

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
    const refImages = parseReferenceImages(item.reference_image_url);
    if (refImages.length > 0) {
      params.set("ref", JSON.stringify(refImages));
    }
    if (item.model === "管理员上传") {
      params.set("ratio", "1:1");
    } else if (item.width && item.height) {
      params.set("ratio", widthHeightToAspectRatio(item.width, item.height));
    }
    window.location.href = `/generate?${params.toString()}`;
  }

  async function handleDownload() {
    setDownloading(true);
    try {
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
    <div>
      <div className="px-4 py-6 md:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          {/* Back button */}
          <button
            type="button"
            onClick={() => {
              const el = imgRef.current;
              if (el) {
                const rect = el.getBoundingClientRect();
                sessionStorage.setItem("inspiration-return-anim", JSON.stringify({
                  id: item._id,
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }));
              }
              router.back();
            }}
            className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="size-4" />
            返回
          </button>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Left: Image + actions + prompt */}
            <div className="flex-1 min-w-0">
              {/* Image */}
              <div
                ref={imgRef}
                className="relative cursor-pointer overflow-hidden rounded-xl bg-gray-100"
                style={imgAnim ? {
                  transform: imgAnim.from,
                  transition: imgAnim.transition,
                } : undefined}
                onClick={() => setFullscreen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toProxyUrl(item.image_url)}
                  alt={item.prompt}
                  width={item.width || undefined}
                  height={item.height || undefined}
                  fetchPriority="high"
                  className="mx-auto w-full object-contain"
                />
                {/* Title & date overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-4 pb-3 pt-8">
                  <h2 className="text-base font-semibold text-white drop-shadow line-clamp-1">
                    {item.title || item.prompt.slice(0, 40)}
                  </h2>
                  <p className="mt-0.5 text-xs text-white/80">
                    {formatDate(item.created_at)}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="animate-detail-content mt-3 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleLike}
                  disabled={liking}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    liked
                      ? "bg-red-50 text-red-500"
                      : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500"
                  } disabled:opacity-50`}
                >
                  {liking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Heart className={`size-4 ${liked ? "fill-current" : ""}`} />
                  )}
                  {likesCount}
                </button>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
                >
                  <Copy className="size-4" />
                  复制提示词
                </button>

                <button
                  type="button"
                  onClick={handleMakeSame}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
                >
                  <Sparkles className="size-4" />
                  做同款
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  下载
                </button>
              </div>

              {/* Prompt section */}
              <div className="animate-detail-content mt-4 rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">提示词</span>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-600"
                  >
                    <Copy className="size-3.5" />
                    复制
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-gray-600 break-all whitespace-pre-wrap">
                  {item.prompt}
                </p>

                {hasRefImages && (
                  <div className="mt-3 border-t pt-3">
                    <button
                      type="button"
                      onClick={() => setShowRefImage(true)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"
                    >
                      <Eye className="size-3.5" />
                      查看参考图（{parseReferenceImages(item.reference_image_url).length} 张）
                    </button>
                  </div>
                )}

                <div className="mt-3 border-t pt-3">
                  <span className="text-xs text-gray-400">
                    模型：{getModelName(item.model)}
                  </span>
                </div>

                {item.watermark_enabled && !isOwner && (
                  <div className="mt-2 text-xs text-gray-400">
                    下载图片将包含水印
                  </div>
                )}
              </div>
            </div>

            {/* Right: Author + comments */}
            <div className="animate-detail-sidebar w-full lg:w-80 shrink-0">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {item.author_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.author_avatar_url}
                      alt={item.username}
                      className="size-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-purple-100 text-sm font-medium text-purple-700">
                      {item.username ? item.username.charAt(0).toUpperCase() : "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${item.user_id}`}
                      target="_blank"
                      className="block truncate text-sm font-medium text-gray-800 hover:text-purple-600 transition-colors"
                    >
                      {item.username || "匿名用户"}
                    </Link>
                    {authorStats && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {authorStats.published_count} 个作品 · {authorStats.total_likes} 赞
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <MessageCircle className="size-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    互动
                  </span>
                </div>
                <div className="mb-3 text-xs text-gray-500">
                  {commentsCount} 条评论
                </div>
                <InspirationComments
                  generationId={item._id}
                  currentUserId={currentUserId}
                  initialCount={item.comments_count || 0}
                  onCountChange={setCommentsCount}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* Full-screen image viewer */}
      {fullscreen && (
        <ImageViewer
          src={toProxyUrl(item.image_url)}
          alt={item.prompt}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}
