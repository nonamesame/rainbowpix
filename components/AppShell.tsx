"use client";

import { decodeUserCookie } from "@/lib/utils";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { TcbUser } from "@/lib/cloudbase/types";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { useNotifications } from "@/hooks/useNotifications";
import AnnouncementModal from "@/components/AnnouncementModal";

interface Announcement {
  _id: string;
  title: string;
  body: string;
  image?: string | null;
  created_at: string;
}

interface Props {
  children: React.ReactNode;
}

const STANDALONE_PATHS = ["/login", "/forgot-password", "/terms", "/privacy", "/complaint"];
const NO_ANNOUNCEMENT_PATHS = ["/profile"];

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const [user, setUser] = useState<TcbUser | null>(null);
  const {
    unreadCount, notifications, loading: notificationsLoading,
    fetchNotifications, markRead, markAllRead, deleteNotification,
  } = useNotifications(user?.uid || null);

  useEffect(() => {
    function refreshUser() {
      const match = document.cookie.match(/tcb_user=([^;]+)/);
      if (match) {
        try {
          const userData = decodeUserCookie(match[1]);
          setUser(userData);
          // Fetch fresh profile data to get username and avatar_url
          fetch("/api/profile")
            .then((r) => r.json())
            .then((data) => {
              if (data.username || data.avatar_url) {
                setUser((prev) => prev ? {
                  ...prev,
                  username: data.username || prev.username,
                  avatar_url: data.avatar_url || prev.avatar_url,
                } : prev);
              }
            })
            .catch(() => {});
        } catch {}
      } else {
        setUser(null);
      }
    }
    refreshUser();
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "user-updated" && e.data.user) {
        setUser(e.data.user);
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === "user-updated") refreshUser();
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshUser);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshUser);
    };
  }, []);

  const isStandalone = STANDALONE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [announcementKey, setAnnouncementKey] = useState(0);

  useEffect(() => {
    if (user?.uid) {
      setAnnouncementDismissed(false);
      setAnnouncementKey((k) => k + 1);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user || isStandalone || announcementDismissed) return;
    if (NO_ANNOUNCEMENT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;

    const sessionKey = `announcement_shown_${user.uid}`;
    if (sessionStorage.getItem(sessionKey)) return;

    let cancelled = false;

    async function checkAnnouncement() {
      try {
        const res = await fetch("/api/announcements");
        if (cancelled || !res.ok) return;
        const data: Announcement[] = await res.json();
        if (!cancelled && data.length > 0) {
          setAnnouncements(data);
          sessionStorage.setItem(sessionKey, "1");
        }
      } catch {}
    }

    checkAnnouncement();
    return () => { cancelled = true; };
  }, [user?.uid, isStandalone, announcementDismissed, announcementKey]);

  function handleDismissAnnouncement() {
    setAnnouncements([]);
    setAnnouncementDismissed(true);
  }

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <TopNav
        user={user}
        unreadCount={unreadCount}
        notifications={notifications}
        notificationsLoading={notificationsLoading}
        fetchNotifications={fetchNotifications}
        markRead={markRead}
        markAllRead={markAllRead}
        deleteNotification={deleteNotification}
      />
      <main className="pb-16 md:pb-0">{children}</main>
      <BottomNav user={user} unreadCount={unreadCount} />

      {announcements.length > 0 && (
        <AnnouncementModal
          announcements={announcements}
          onClose={handleDismissAnnouncement}
        />
      )}
    </div>
  );
}
