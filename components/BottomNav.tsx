"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Palette, ImageIcon, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TcbUser } from "@/lib/cloudbase/types";

interface Props {
  user: TcbUser | null;
}

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/generate", label: "AI绘画", icon: Palette },
  { href: "/gallery", label: "画廊", icon: ImageIcon, requireAuth: true },
  { href: "/login", label: "我的", icon: User },
];

export default function BottomNav({ user }: Props) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-white/95 backdrop-blur-md px-2 py-1 safe-area-bottom">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const needsLogin = item.requireAuth && !user;
        const href = needsLogin ? "/login" : item.href;

        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] transition-colors min-w-[56px]",
              isActive
                ? "text-[#7c3aed]"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="size-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
