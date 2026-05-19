"use client";

import { usePathname } from "next/navigation";
import { TcbUser } from "@/lib/cloudbase/types";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

interface Props {
  user: TcbUser | null;
  children: React.ReactNode;
}

const STANDALONE_PATHS = ["/login", "/terms", "/privacy", "/complaint"];

export default function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const isStandalone = STANDALONE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <TopNav user={user} />
      <main className="pb-16 md:pb-0">{children}</main>
      <BottomNav user={user} />
    </div>
  );
}
