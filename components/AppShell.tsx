"use client";

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
  user: TcbUser | null;
  children: React.ReactNode;
}

const STANDALONE_PATHS = ["/login", "/terms", "/privacy", "/complaint"];

export default function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const {
    unreadCount, notifications, loading: notificationsLoading,
    fetchNotifications, markRead, markAllRead, deleteNotification,
  } = useNotifications(user?.uid || null);
  const isStandalone = STANDALONE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [prevUid, setPrevUid] = useState<string | null>(user?.uid || null);

  useEffect(() => {
    if (user?.uid !== prevUid) {
      setAnnouncements([]);
      setAnnouncementDismissed(false);
      setPrevUid(user?.uid || null);
    }
  }, [user?.uid, prevUid]);

  useEffect(() => {
    if (!user || isStandalone || announcementDismissed) return;

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
  }, [user?.uid, isStandalone, announcementDismissed]);

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
