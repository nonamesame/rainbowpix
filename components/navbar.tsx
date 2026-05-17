"use client";

import Image from "next/image";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

export default function Navbar({ user }: { user: User | null }) {
  const email = user?.email ? user.email.length > 18 ? user.email.slice(0, 18) + "..." : user.email : null;

  return (
    <nav className="h-14 border-b bg-white/80 backdrop-blur-sm flex items-center justify-between px-6">
      <Link href="/generate" className="flex items-center gap-2">
        <Image src="/logo.svg" alt="Logo" width={28} height={28} />
        <span className="text-base font-semibold text-[#1f2937]">RainbowPix</span>
      </Link>
      <div>
        {user ? (
          <span className="text-sm text-gray-600" title={user.email ?? ""}>
            {email}
          </span>
        ) : (
          <Link href="/login">
            <Button variant="ghost" className="text-sm font-medium text-[#1f2937] hover:text-[#7c3aed]">
              登录
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
