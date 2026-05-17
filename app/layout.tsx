import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Toaster } from "react-hot-toast";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/navbar";
import "./globals.css";

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar user={user} />
        {children}
        <Toaster position="top-center" />
        <footer className="border-t bg-white/80 py-6 mt-auto">
          <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-[#7c3aed]">用户服务协议</Link>
            <Link href="/privacy" className="hover:text-[#7c3aed]">隐私政策</Link>
            <Link href="/complaint" className="hover:text-[#7c3aed]">侵权投诉</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
