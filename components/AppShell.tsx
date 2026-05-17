"use client";

import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";

interface Props {
  user: User | null;
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
    <div className="dashboard-layout">
      <Sidebar user={user} />
      <main className="ml-[240px] min-h-screen overflow-y-auto xl:mr-[280px]">
        {children}
      </main>
      <RightSidebar />
    </div>
  );
}
