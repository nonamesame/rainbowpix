"use client";

import { useState, useEffect } from "react";
import { Bell, Heart, MessageCircle, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Notification } from "@/lib/notifications";

function parseBodyWithImages(body: string) {
  const parts: { type: "text" | "image"; content: string; alt?: string }[] = [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: body.slice(lastIndex, match.index) });
    }
    parts.push({ type: "image", content: match[2], alt: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push({ type: "text", content: body.slice(lastIndex) });
  }

  return parts;
}

interface Props {
  notifications: Notification[];
  initialNotification: Notification | null;
  loading: boolean;
  onMarkRead: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const iconMap: Record<string, typeof Bell> = {
  system: Bell,
  like: Heart,
  comment: MessageCircle,
  announcement: Bell,
};

const typeLabel: Record<string, { label: string; color: string }> = {
  system: { label: "系统通知", color: "bg-purple-100 text-purple-700" },
  announcement: { label: "公告", color: "bg-orange-100 text-orange-700" },
  like: { label: "点赞", color: "bg-red-100 text-red-700" },
  comment: { label: "评论", color: "bg-blue-100 text-blue-700" },
};

export default function NotificationModal({ notifications, initialNotification, loading, onMarkRead, onDelete, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialNotification?._id || null);

  // 从 notifications 列表中获取最新状态
  const selectedNotification = notifications.find((n) => n._id === selectedId) || initialNotification;

  useEffect(() => {
    if (initialNotification) {
      setSelectedId(initialNotification._id);
      // 标记为已读
      if (!initialNotification.read) {
        onMarkRead([initialNotification._id]);
      }
    }
  }, [initialNotification?._id]); // 只依赖 ID，避免重复调用

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function handleSelect(n: Notification) {
    setSelectedId(n._id);
    if (!n.read) {
      onMarkRead([n._id]);
    }
  }

  function handleDelete(id: string) {
    onDelete(id);
    if (selectedId === id) {
      setSelectedId(null);
    }
  }

  function handleOpenLink() {
    if (selectedNotification?.link) {
      window.location.href = selectedNotification.link;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative mx-4 flex h-[70vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="size-5" />
        </button>

        {/* Left: Notification List */}
        <div className="flex w-64 flex-col border-r border-gray-200">
          <div className="border-b border-gray-200 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">通知</span>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                加载中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Bell className="mb-2 size-8" />
                <span className="text-sm">暂无通知</span>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = iconMap[n.type] || Bell;
                const isSelected = n._id === selectedId;
                return (
                  <div
                    key={n._id}
                    className={`group relative flex gap-3 border-b border-gray-100 px-4 py-3 transition-colors ${
                      isSelected ? "bg-purple-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => handleSelect(n)}
                      className="flex flex-1 gap-3 text-left"
                    >
                      <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                        n.type === "like" ? "bg-red-50 text-red-500"
                          : n.type === "comment" ? "bg-blue-50 text-blue-500"
                          : n.type === "announcement" ? "bg-orange-50 text-orange-500"
                          : "bg-purple-50 text-purple-500"
                      }`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate ${isSelected ? "text-purple-700" : "text-gray-900"}`}>
                            {n.title}
                          </span>
                          {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-purple-500" />}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{n.body}</p>
                        <span className="mt-1 block text-[10px] text-gray-400">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: zhCN })}
                        </span>
                      </div>
                    </button>
                    {n.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(n._id);
                        }}
                        className="absolute right-2 top-2 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                        title="删除通知"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Detail View */}
        <div className="flex min-w-0 flex-1 flex-col">
          {selectedNotification ? (
            <>
              <div className="flex items-start gap-3 border-b border-gray-200 p-6">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
                  selectedNotification.type === "like" ? "bg-red-50 text-red-500"
                    : selectedNotification.type === "comment" ? "bg-blue-50 text-blue-500"
                    : selectedNotification.type === "announcement" ? "bg-orange-50 text-orange-500"
                    : "bg-purple-50 text-purple-500"
                }`}>
                  {(() => {
                    const Icon = iconMap[selectedNotification.type] || Bell;
                    return <Icon className="size-6" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedNotification.title}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${typeLabel[selectedNotification.type]?.color || "bg-gray-100 text-gray-600"}`}>
                      {typeLabel[selectedNotification.type]?.label || selectedNotification.type}
                    </span>
                  </div>
                  <span className="mt-1 block text-sm text-gray-400">
                    {formatDistanceToNow(new Date(selectedNotification.created_at), { addSuffix: true, locale: zhCN })}
                  </span>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-6">
                {selectedNotification.image && (
                  <img
                    src={selectedNotification.image}
                    alt={selectedNotification.title}
                    className="mb-4 w-full rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div className="space-y-3 text-sm leading-relaxed text-gray-700">
                  {parseBodyWithImages(selectedNotification.body || "").map((part, i) =>
                    part.type === "image" ? (
                      <img
                        key={i}
                        src={part.content}
                        alt={part.alt || ""}
                        className="max-h-64 w-full rounded-lg object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <p key={i} className="break-all whitespace-pre-wrap">
                        {part.content}
                      </p>
                    )
                  )}
                </div>
              </div>
              <div className="flex gap-3 border-t border-gray-200 p-4">
                {selectedNotification.link && (
                  <button
                    onClick={handleOpenLink}
                    className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    查看详情
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedNotification._id)}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  删除
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-gray-400">
              <Bell className="mb-3 size-12" />
              <span className="text-sm">选择一条通知查看详情</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
