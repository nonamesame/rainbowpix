"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { Sparkles, Paintbrush, ImageIcon, LogOut, Megaphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TcbUser } from "@/lib/cloudbase/types";
import { getAuth } from "@/lib/cloudbase/client";
import NotificationBell from "./NotificationBell";
import AnnouncementModal from "./AnnouncementModal";
import ThemeSwitcher from "./ThemeSwitcher";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
}: Props) {
  const pathname = usePathname();
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // 额度相关
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [redeemKey, setRedeemKey] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [hoveringAvatar, setHoveringAvatar] = useState(false);

  // 获取额度余额
  useEffect(() => {
    if (user?.uid) {
      fetch("/api/credits/balance")
        .then((r) => r.json())
        .then((data) => setCreditBalance(data.balance))
        .catch(() => {});
    }
  }, [user?.uid]);

  async function handleRedeemKey() {
    if (!redeemKey.trim()) {
      toast.error("请输入密钥");
      return;
    }

    setRedeeming(true);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: redeemKey.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`兑换成功！获得 ${data.credits_added} 额度`);
        setCreditBalance(data.balance);
        setRedeemKey("");
        setShowRedeemDialog(false);
      } else {
        toast.error(data.error || "兑换失败");
      }
    } catch {
      toast.error("兑换失败，请重试");
    } finally {
      setRedeeming(false);
    }
  }

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
      <div className="flex flex-col items-center gap-3">
        <ThemeSwitcher />
        {!authChecked ? null : user ? (
          <>
            <button
              onClick={fetchAnnouncements}
              className="flex flex-col items-center gap-1 text-gray-400 transition-colors hover:text-brand"
              title="查看公告"
            >
              <Megaphone className="size-5" />
            </button>
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
            <div
              className="relative"
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
              className="flex flex-col items-center gap-1 text-gray-400 transition-colors hover:text-red-500"
              title="退出登录"
            >
              <LogOut className="size-5" />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="flex flex-col items-center gap-1 text-gray-400 transition-colors hover:text-brand"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-brand-light text-xs font-medium text-brand">
              登
            </div>
            <span className="text-[10px]">登录</span>
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
      <Dialog open={showRedeemDialog} onOpenChange={(open) => { if (!open) setShowRedeemDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>兑换额度</DialogTitle>
            <DialogDescription>输入密钥以兑换生成额度</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">密钥</label>
              <input
                type="text"
                value={redeemKey}
                onChange={(e) => setRedeemKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRedeemKey()}
                placeholder="输入 64 位密钥"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
              />
            </div>
            {creditBalance !== null && (
              <p className="text-xs text-gray-500">
                当前余额: <span className="font-medium text-gray-700">{creditBalance}</span> 额度
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setShowRedeemDialog(false)}>取消</Button>
            <Button className="rounded-full" onClick={handleRedeemKey} disabled={redeeming || !redeemKey.trim()}>
              {redeeming ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              兑换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
