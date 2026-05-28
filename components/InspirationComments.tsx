"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Heart, Trash2, Loader2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { GalleryComment } from "@/lib/inspiration";

interface Props {
  generationId: string;
  currentUserId?: string;
  initialCount: number;
  onCountChange: (count: number) => void;
}

export default function InspirationComments({
  generationId,
  currentUserId,
  initialCount,
  onCountChange,
}: Props) {
  const [comments, setComments] = useState<GalleryComment[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialCount);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");

  const fetchComments = useCallback(
    async (p: number, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await fetch(
          `/api/inspiration/${generationId}/comments?page=${p}`
        );
        const data = await res.json();
        if (!res.ok) return;
        setComments((prev) =>
          append ? [...prev, ...data.items] : data.items
        );
        setTotal(data.total);
        setHasMore(data.hasMore);
        onCountChange(data.total);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [generationId, onCountChange]
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchComments(1), 100);
    return () => clearTimeout(timer);
  }, [fetchComments]);

  async function handleSubmit() {
    if (!currentUserId) {
      toast.error("请先登录");
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      toast.error("评论内容不能超过 500 字");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inspiration/${generationId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "发送失败");
        return;
      }
      setComments((prev) => [data.comment, ...prev]);
      setTotal(data.comments_count);
      onCountChange(data.comments_count);
      setContent("");
    } catch {
      toast.error("发送失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      const res = await fetch(
        `/api/inspiration/${generationId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      setTotal(data.comments_count);
      onCountChange(data.comments_count);
    } catch {
      toast.error("删除失败");
    }
  }

  async function handleLikeComment(commentId: string) {
    if (!currentUserId) {
      toast.error("请先登录");
      return;
    }
    try {
      const res = await fetch(
        `/api/inspiration/${generationId}/comments/${commentId}/like`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? { ...c, user_liked: data.liked, likes_count: data.likes_count }
            : c
        )
      );
    } catch {
      toast.error("操作失败");
    }
  }

  function getInitial(name: string) {
    return name ? name.charAt(0).toUpperCase() : "?";
  }

  return (
    <div className="space-y-3">
      {/* Comment list */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-gray-400" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">暂无评论</p>
      ) : (
        <div className="max-h-[50vh] space-y-3 overflow-y-auto overscroll-contain">
          {comments.map((comment) => (
            <div key={comment._id} className="flex gap-2.5">
              {/* Avatar */}
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-700">
                {getInitial(comment.username)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-800">
                    {comment.username}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-gray-600 break-all">
                  {comment.content}
                </p>
                {/* Actions */}
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleLikeComment(comment._id)}
                    className={`inline-flex items-center gap-1 text-xs transition-colors ${
                      comment.user_liked
                        ? "text-red-500"
                        : "text-gray-400 hover:text-red-400"
                    }`}
                  >
                    <Heart
                      className={`size-3 ${comment.user_liked ? "fill-current" : ""}`}
                    />
                    {comment.likes_count > 0 && comment.likes_count}
                  </button>
                  {currentUserId === comment.user_id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment._id)}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <button
              type="button"
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchComments(nextPage, true);
              }}
              disabled={loadingMore}
              className="w-full py-2 text-center text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="mx-auto size-4 animate-spin" />
              ) : (
                "加载更多"
              )}
            </button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            currentUserId ? "写评论..." : "请先登录后再评论"
          }
          disabled={!currentUserId || submitting}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-purple-300 focus:bg-white disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim() || submitting || !currentUserId}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
