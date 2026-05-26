"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Palette, ImageIcon, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TcbUser } from "@/lib/cloudbase/types";

interface Props {
  user: TcbUser | null;
  authChecked: boolean;
  unreadCount?: number;
}

const navItems = [
  { href: "/", label: "灵感", icon: Sparkles },
  { href: "/generate", label: "生成", icon: Palette },
  { href: "/gallery", label: "画廊", icon: ImageIcon, requireAuth: true },
];

export default function BottomNav({ user, authChecked, unreadCount }: Props) {
  const pathname = usePathname();

  const myItem = user
    ? { href: "/profile", label: "我的", icon: User, target: "_blank" as const }
    : { href: "/login", label: "我的", icon: User };

  const allItems = [...navItems, myItem];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-gray-100 bg-white/95 backdrop-blur-md px-2 py-1 safe-area-bottom">
      {allItems.map((item) => {
        const Icon = item.icon;
        const isMyTab = item.label === "我的";

        // "我的" tab: show disabled placeholder while auth is loading
        if (isMyTab && !authChecked) {
          return (
            <div
              key={item.href}
              className="relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] min-w-[56px] text-gray-300"
            >
              <Icon className="size-5" />
              <span className="font-medium">{item.label}</span>
            </div>
          );
        }

        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const needsLogin = "requireAuth" in item && item.requireAuth && !user;
        const href = needsLogin ? "/login" : item.href;

        return (
          <Link
            key={item.href}
            href={href}
            target={"target" in item ? item.target : undefined}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] transition-colors min-w-[56px]",
              isActive
                ? "text-violet-600"
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Icon className="size-5" />
            <span className="font-medium">{item.label}</span>
            {isMyTab && user && unreadCount && unreadCount > 0 && (
              <span className="absolute -right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                {unreadCount > 99 ? "99" : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
