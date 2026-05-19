"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { TcbUser } from "@/lib/cloudbase/types";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuth } from "@/lib/cloudbase/client";

interface Props {
  user: TcbUser | null;
}

const navItems = [
  { href: "/", label: "首页" },
  { href: "/generate", label: "AI绘画" },
  { href: "/gallery", label: "画廊" },
];

export default function TopNav({ user }: Props) {
  const pathname = usePathname();

  const handleLogout = async () => {
    const auth = getAuth();
    await auth.signOut();
    document.cookie = "tcb_access_token=; path=/; max-age=0";
    document.cookie = "tcb_user=; path=/; max-age=0";
    window.location.href = "/login";
  };

  return (
    <nav className="hidden md:flex h-14 items-center justify-between border-b bg-white/80 backdrop-blur-md px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="Logo" width={28} height={28} />
        <span className="text-base font-semibold text-gray-800">RainbowPix</span>
      </Link>

      {/* Nav Links */}
      <div className="flex items-center gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-purple-50 text-[#7c3aed]"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* User */}
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-purple-100 text-sm font-medium text-[#7c3aed]">
              {user.email?.charAt(0).toUpperCase() || user.phone?.charAt(0) || "U"}
            </div>
            <span className="text-sm text-gray-600 max-w-[100px] truncate">
              {user.email || user.phone || "用户"}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
              title="退出登录"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-[#7c3aed] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#6d28d9]"
          >
            登录
          </Link>
        )}
      </div>
    </nav>
  );
}
