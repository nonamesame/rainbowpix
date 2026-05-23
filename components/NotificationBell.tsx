"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TcbUser } from "@/lib/cloudbase/types";
import type { Notification } from "@/lib/notifications";
import NotificationPanel from "./NotificationPanel";
import NotificationModal from "./NotificationModal";

interface Props {
  user: TcbUser | null;
  unreadCount: number;
  notifications: Notification[];
  loading: boolean;
  fetchNotifications: () => void;
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
}

export default function NotificationBell({
  user, unreadCount, notifications, loading, fetchNotifications, markRead, markAllRead, deleteNotification,
}: Props) {
  const [open, setOpen] = useState(false);
  const [modalNotification, setModalNotification] = useState<Notification | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifications();
  }

  function handleSelectNotification(n: Notification) {
    // 先标记为已读
    if (!n.read) {
      markRead([n._id]);
    }
    // 创建一个 read: true 的副本，确保模态窗口立即显示已读状态
    setModalNotification({ ...n, read: true });
  }

  function handleCloseModal() {
    setModalNotification(null);
    fetchNotifications();
  }

  if (!user) return null;

  return (
    <>
      <div className="relative" ref={panelRef}>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 text-gray-500 hover:text-gray-700"
          onClick={handleToggle}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
            <NotificationPanel
              notifications={notifications}
              loading={loading}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onDelete={deleteNotification}
              onSelect={handleSelectNotification}
              onClose={() => setOpen(false)}
            />
          </div>
        )}
      </div>

      {modalNotification && createPortal(
        <NotificationModal
          notifications={notifications}
          initialNotification={modalNotification}
          loading={loading}
          onMarkRead={markRead}
          onDelete={deleteNotification}
          onClose={handleCloseModal}
        />,
        document.body
      )}
    </>
  );
}
