"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { Sparkles, Paintbrush, ImageIcon, LogOut, Megaphone, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { TcbUser } from "@/lib/cloudbase/types";
import { getAuth } from "@/lib/cloudbase/client";
import NotificationBell from "./NotificationBell";
import AnnouncementModal from "./AnnouncementModal";
import ThemeSwitcher from "./ThemeSwitcher";
import RedeemDialog from "./RedeemDialog";
import TaskDialog from "./TaskDialog";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import type { Notification } from "@/lib/notifications";

interface Props {
  user: TcbUser | null;
  authChecked: boolean;
  unreadCount: number;
  notifications: Notification[];
  notificationsLoading: boolean;
  fetchNotifications: () => void;
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
  hasUnclaimedTasks: boolean;
  refreshTaskStatus: () => void;
}

const navItems = [
  { href: "/", label: "灵感", icon: Sparkles },
  { href: "/generate", label: "生成", icon: Paintbrush },
  { href: "/gallery", label: "画廊", icon: ImageIcon },
];

interface Announcement {
  _id: string;
  title: string;
  body: string;
  image?: string | null;
  created_at: string;
}

export default function Sidebar({
  user, authChecked, unreadCount, notifications, notificationsLoading,
  fetchNotifications, markRead, markAllRead, deleteNotification,
  hasUnclaimedTasks, refreshTaskStatus,
}: Props) {
  const pathname = usePathname();
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // 额度相关
  const { balance: creditBalance } = useCreditBalance();
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [hoveringAvatar, setHoveringAvatar] = useState(false);

  // 任务相关
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setAnnouncements(data);
          setShowAnnouncement(true);
        } else {
          toast("暂时没有公告");
        }
      }
    } catch {}
  }, []);

  async function handleLogout() {
    const auth = getAuth();
    await auth.signOut();
    document.cookie = "tcb_access_token=; path=/; max-age=0";
    document.cookie = "tcb_user=; path=/; max-age=0";
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login";
  }

  return (
    <>
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 w-16 flex-col items-center border-r border-gray-100 bg-white py-4">
      {/* Logo */}
      <Link href="/" className="mb-6 flex items-center justify-center">
        <Image src="/logo.png" alt="Logo" width={28} height={28} />
      </Link>

      {/* Nav Items */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const needsLogin = item.href === "/gallery" && !user;
          const href = needsLogin ? "/login" : item.href;

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "relative flex w-12 flex-col items-center gap-1 rounded-lg py-2.5 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-brand"
                  : "text-gray-400 hover:text-gray-700"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-brand" />
              )}
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-10 w-12 items-center justify-center">
          <ThemeSwitcher />
        </div>
        {!authChecked ? null : user ? (
          <>
            <button
              onClick={() => setShowTaskDialog(true)}
              className="relative flex h-10 w-12 flex-col items-center justify-center gap-0.5 text-gray-400 transition-colors hover:text-brand"
              title="每日任务"
            >
              <Calendar className="size-5" />
              {hasUnclaimedTasks && (
                <span className="absolute right-2 top-1 size-2 rounded-full bg-red-500" />
              )}
            </button>
            <button
              onClick={fetchAnnouncements}
              className="flex h-10 w-12 flex-col items-center justify-center text-gray-400 transition-colors hover:text-brand"
              title="查看公告"
            >
              <Megaphone className="size-5" />
            </button>
            <div className="flex h-10 w-12 items-center justify-center">
              <NotificationBell
                user={user}
                unreadCount={unreadCount}
                notifications={notifications}
                loading={notificationsLoading}
                fetchNotifications={fetchNotifications}
                markRead={markRead}
                markAllRead={markAllRead}
                deleteNotification={deleteNotification}
              />
            </div>
            <div
              className="relative flex h-10 w-12 items-center justify-center"
              onMouseEnter={() => setHoveringAvatar(true)}
              onMouseLeave={() => setHoveringAvatar(false)}
            >
              <Link
                href="/profile"
                target="_blank"
                className="flex flex-col items-center gap-1"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="头像"
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-brand-light text-xs font-medium text-brand">
                    {user.username?.charAt(0).toUpperCase() ||
                      user.email?.charAt(0).toUpperCase() ||
                      user.phone?.charAt(0) ||
                      "U"}
                  </div>
                )}
              </Link>

              {/* 额度浮出面板 */}
              {hoveringAvatar && (
                <>
                  {/* 透明桥接区域，防止鼠标移动时面板消失 */}
                  <div className="absolute left-full top-0 h-full w-3" />
                  <div
                    className="absolute left-full ml-3 bottom-[-8px] z-50 w-48 rounded-xl border border-gray-200 bg-white p-3 shadow-lg animate-in fade-in slide-in-from-left-2 duration-200"
                  >
                    <div className="mb-2 flex items-center justify-center gap-1.5">
                      <span className="text-[11px] text-gray-400">额度</span>
                      <span className="text-lg text-gray-900">
                        {creditBalance !== null ? creditBalance : "--"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setShowRedeemDialog(true);
                        setHoveringAvatar(false);
                      }}
                      className="w-full rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark"
                    >
                      获取更多
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex h-10 w-12 flex-col items-center justify-center text-gray-400 transition-colors hover:text-red-500"
              title="退出登录"
            >
              <LogOut className="size-5" />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="flex h-10 w-12 flex-col items-center justify-center text-gray-400 transition-colors hover:text-brand"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-brand-light text-xs font-medium text-brand">
              登
            </div>
          </Link>
        )}
      </div>
    </nav>

      {showAnnouncement && announcements.length > 0 && (
        <AnnouncementModal
          announcements={announcements}
          onClose={() => setShowAnnouncement(false)}
        />
      )}

      {/* 兑换额度对话框 */}
      <RedeemDialog
        open={showRedeemDialog}
        onOpenChange={setShowRedeemDialog}
      />

      {/* 任务对话框 */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        onTasksChanged={refreshTaskStatus}
      />
    </>
  );
}
