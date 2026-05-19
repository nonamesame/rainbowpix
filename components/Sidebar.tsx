"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TcbUser } from "@/lib/cloudbase/types";
import {
  Palette,
  Image as ImageIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuth } from "@/lib/cloudbase/client";
import { useState } from "react";

interface Props {
  user: TcbUser | null;
}

const navItems = [
  { href: "/generate", label: "AI 绘画", icon: Palette },
  { href: "/gallery", label: "我的画廊", icon: ImageIcon },
];

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    const auth = getAuth();
    await auth.signOut();
    document.cookie = "tcb_access_token=; path=/; max-age=0";
    document.cookie = "tcb_user=; path=/; max-age=0";
    window.location.href = "/login";
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-full flex-col border-r bg-white/80 backdrop-blur-md transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Logo" width={28} height={28} />
          {!collapsed && (
            <span className="text-base font-semibold text-gray-800">
              RainbowPix
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/generate" && pathname === "/");
            const Icon = item.icon;

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-purple-50 font-medium text-[#7c3aed]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t px-3 py-3">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-medium text-[#7c3aed]">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p
                  className="truncate text-sm font-medium text-gray-700"
                  title={user.email ?? ""}
                >
                  {user.email}
                </p>
                <button
                  onClick={handleLogout}
                  className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
                >
                  <LogOut className="size-3" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-3 py-2 text-sm font-medium text-white hover:bg-[#6d28d9]"
          >
            {!collapsed && <span>登录</span>}
          </Link>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 z-50 flex size-6 items-center justify-center rounded-full border bg-white text-gray-500 shadow-sm hover:text-gray-700"
      >
        {collapsed ? (
          <ChevronRight className="size-3" />
        ) : (
          <ChevronLeft className="size-3" />
        )}
      </button>
    </aside>
  );
}
