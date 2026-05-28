"use client";

import { useRef, useState, useMemo } from "react";
import { Bell, Heart, MessageCircle, Trash2, ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Notification } from "@/lib/notifications";

type TabType = "all" | "like" | "comment" | "comment_like" | "system" | "announcement";

const tabs: { key: TabType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "like", label: "点赞" },
  { key: "comment", label: "评论" },
  { key: "comment_like", label: "评论获赞" },
  { key: "system", label: "系统" },
  { key: "announcement", label: "公告" },
];

interface Props {
  notifications: Notification[];
  loading: boolean;
  onMarkRead: (ids: string[]) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onSelect: (notification: Notification) => void;
  onClose: () => void;
}

const iconMap: Record<string, typeof Bell> = {
  system: Bell,
  like: Heart,
  comment: MessageCircle,
  comment_like: ThumbsUp,
  announcement: Bell,
};

const typeLabel: Record<string, { label: string; color: string }> = {
  system: { label: "系统通知", color: "bg-purple-100 text-purple-700" },
  announcement: { label: "公告", color: "bg-orange-100 text-orange-700" },
  like: { label: "点赞", color: "bg-red-100 text-red-700" },
  comment: { label: "评论", color: "bg-blue-100 text-blue-700" },
  comment_like: { label: "评论获赞", color: "bg-pink-100 text-pink-700" },
};

export default function NotificationPanel({ notifications, loading, onMarkRead, onMarkAllRead, onDelete, onSelect, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabType, number> = { all: notifications.length, like: 0, comment: 0, comment_like: 0, system: 0, announcement: 0 };
    for (const n of notifications) {
      if (n.type in counts) counts[n.type as keyof typeof counts]++;
    }
    return counts;
  }, [notifications]);

  function handleClick(n: Notification) {
    if (!n.read) {
      onMarkRead([n._id]);
    }
    onSelect(n);
    onClose();
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">通知</span>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-purple-600 hover:text-purple-700"
          >
            全部已读
          </button>
        )}
      </div>
      <div className="flex gap-0.5 overflow-x-auto border-b px-3 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex min-h-[26px] shrink-0 flex-col items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-purple-100 text-purple-700"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <span>{tab.label}</span>
            {tabCounts[tab.key] > 0 && (
              <span className="text-[10px] opacity-60">{tabCounts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>
      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            加载中...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Bell className="mb-2 size-8" />
            <span className="text-sm">暂无通知</span>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const Icon = iconMap[n.type] || Bell;
            return (
              <div
                key={n._id}
                className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
                  !n.read ? "bg-purple-50/50" : ""
                }`}
              >
                <button
                  onClick={() => handleClick(n)}
                  className="flex flex-1 gap-3 text-left"
                >
                  <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                    n.type === "like" ? "bg-red-50 text-red-500"
                      : n.type === "comment" ? "bg-blue-50 text-blue-500"
                      : n.type === "comment_like" ? "bg-pink-50 text-pink-500"
                      : n.type === "announcement" ? "bg-orange-50 text-orange-500"
                      : "bg-purple-50 text-purple-500"
                  }`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 min-w-0 break-all">{n.title}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${typeLabel[n.type]?.color || "bg-gray-100 text-gray-600"}`}>
                        {typeLabel[n.type]?.label || n.type}
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
                      onDelete(n._id);
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
  );
}
