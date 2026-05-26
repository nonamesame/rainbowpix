"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { TcbUser } from "@/lib/cloudbase/types";
import type { Notification } from "@/lib/notifications";
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
  const [showModal, setShowModal] = useState(false);

  function handleClick() {
    fetchNotifications();
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    fetchNotifications();
  }

  if (!user) return null;

  return (
    <>
      <button
        className="relative flex size-9 items-center justify-center text-gray-400 transition-colors hover:text-violet-600"
        onClick={handleClick}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {showModal && createPortal(
        <NotificationModal
          notifications={notifications}
          initialNotification={notifications[0] || null}
          loading={loading}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onDelete={deleteNotification}
          onClose={handleCloseModal}
        />,
        document.body
      )}
    </>
  );
}
