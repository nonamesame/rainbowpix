"use client";

import { decodeUserCookie } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { TcbUser } from "@/lib/cloudbase/types";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import ScrollToTop from "@/components/ScrollToTop";
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
  const [authChecked, setAuthChecked] = useState(false);
  const {
    unreadCount, notifications, loading: notificationsLoading,
    fetchNotifications, markRead, markAllRead, deleteNotification,
  } = useNotifications(user?.uid || null);

  // Read user from cookie, optionally preserving existing state or waiting for API
  const readUserFromCookie = useCallback((opts?: { preserveExisting?: boolean; waitForApi?: boolean; skipApi?: boolean }) => {
    const { preserveExisting = false, waitForApi = false, skipApi = false } = opts || {};
    try {
      const match = document.cookie.match(/tcb_user=([^;]+)/);
      if (match) {
        const userData = decodeUserCookie(match[1]);
        // Use cached avatar_url as fallback when cookie lacks it (prevents flash to initials)
        const cachedAvatar = !userData.avatar_url ? localStorage.getItem("cached_avatar_url") : null;
        if (cachedAvatar) userData.avatar_url = cachedAvatar;

        setUser((prev) => {
          if (!prev) return userData;
          if (preserveExisting) {
            return {
              ...userData,
              avatar_url: userData.avatar_url || prev.avatar_url,
              username: userData.username || prev.username,
            };
          }
          return userData;
        });
        // Fetch fresh data from API
        if (!skipApi) fetch("/api/profile")
          .then((r) => r.json())
          .then((data) => {
            if (data.username || data.avatar_url) {
              // Keep cache in sync so next navigation is instant
              if (data.avatar_url) {
                try { localStorage.setItem("cached_avatar_url", data.avatar_url); } catch {}
              }
              setUser((prev) => prev ? {
                ...prev,
                username: data.username || prev.username,
                avatar_url: data.avatar_url || prev.avatar_url,
              } : prev);
            }
            if (waitForApi) setAuthChecked(true);
          })
          .catch(() => {
            if (waitForApi) setAuthChecked(true);
          });
      } else {
        if (!preserveExisting) setUser(null);
        if (waitForApi) setAuthChecked(true);
      }
    } catch {
      if (!preserveExisting) setUser(null);
      if (waitForApi) setAuthChecked(true);
    }
  }, []);

  // Initial load: read cookie + wait for API before showing, retry for propagation delay
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    readUserFromCookie({ waitForApi: true });

    let retries = 0;
    function retryRefresh() {
      if (retries >= 5) return;
      const match = document.cookie.match(/tcb_user=([^;]+)/);
      if (!match) {
        retries++;
        retryTimer = setTimeout(retryRefresh, 400);
      } else {
        readUserFromCookie({ waitForApi: true });
      }
    }
    retryTimer = setTimeout(retryRefresh, 400);

    // Safety: force authChecked after 3s in case API or cookie read got stuck
    fallbackTimer = setTimeout(() => setAuthChecked(true), 3000);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [readUserFromCookie]);

  // On pathname change: refresh cookie in background without clearing state or hitting API
  useEffect(() => {
    readUserFromCookie({ preserveExisting: true, skipApi: true });
  }, [pathname, readUserFromCookie]);

  // Event listeners: focus, cross-tab updates
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "user-updated" && e.data.user) {
        setUser(e.data.user);
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === "user-updated") readUserFromCookie({ preserveExisting: true });
    }
    function onFocus() {
      readUserFromCookie({ preserveExisting: true });
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [readUserFromCookie]);

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
      <Sidebar
        user={user}
        authChecked={authChecked}
        unreadCount={unreadCount}
        notifications={notifications}
        notificationsLoading={notificationsLoading}
        fetchNotifications={fetchNotifications}
        markRead={markRead}
        markAllRead={markAllRead}
        deleteNotification={deleteNotification}
      />
      <main className="md:ml-16 pb-16 md:pb-0">{children}</main>
      <BottomNav user={user} authChecked={authChecked} unreadCount={unreadCount} />
      <ScrollToTop />

      {announcements.length > 0 && (
        <AnnouncementModal
          announcements={announcements}
          onClose={handleDismissAnnouncement}
        />
      )}
    </div>
  );
}
