"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Notification } from "@/lib/notifications";

const POLL_INTERVAL = 60_000; // 60秒轮询一次

export function useNotifications(uid: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchCount = useCallback(async () => {
    if (!uid) return;
    try {
      const res = await fetch(`/api/notifications/unread-count?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {}
  }, [uid]);

  const fetchNotifications = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?page=1&pageSize=20&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items);
        setUnreadCount(data.unread_count);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [uid]);

  const markRead = useCallback(async (ids: string[]) => {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        setUnreadCount((c) => Math.max(0, c - ids.length));
        setNotifications((prev) =>
          prev.map((n) => (ids.includes(n._id) ? { ...n, read: true } : n))
        );
      } else {
        console.error("Mark read failed:", data.error);
      }
    } catch (e) {
      console.error("Mark read error:", e);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/delete?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
        // 如果删除的是未读通知，更新未读数
        const deleted = notifications.find((n) => n._id === id);
        if (deleted && !deleted.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
      }
    } catch {}
  }, [notifications]);

  useEffect(() => {
    if (!uid) return;
    fetchCount();
    fetchNotifications();

    // 页面可见时轮询，不可见时暂停
    function startPolling() {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchCount, POLL_INTERVAL);
    }

    function stopPolling() {
      clearInterval(intervalRef.current);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchCount();
        startPolling();
      } else {
        stopPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [uid, fetchCount, fetchNotifications]);

  return {
    unreadCount,
    notifications,
    loading,
    fetchNotifications,
    fetchCount,
    markRead,
    markAllRead,
    deleteNotification,
  };
}
