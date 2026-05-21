import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";
import AppShell from "@/components/AppShell";
import "./globals.css";

// 强制动态渲染，确保每次导航时重新读取cookie
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RainbowPix",
  description: "RainbowPix - AI Image Generator",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("tcb_user")?.value;
  let user = null;

  if (userCookie) {
    try {
      user = JSON.parse(atob(userCookie));
    } catch {
      user = null;
    }
  }

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell user={user}>{children}</AppShell>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
