import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "react-hot-toast";
import AppShell from "@/components/AppShell";
import NavigationProgress from "@/components/NavigationProgress";
import { themeInitScript } from "@/components/ThemeSwitcher";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="baidu_union_verify" content="e916140d9a7f7a65293e61429c979f40" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        {/*
          Blocking script: runs before React hydrates to prevent flash on bfcache restore.
          Reads sessionStorage for return-animation ID and hides the target card via CSS
          before the browser paints the restored page.
        */}
        {/*
          Chunk loading failure recovery: auto-reload on dynamic import errors
          (common after redeployment when old chunks are no longer served).
        */}
        <Script
          id="chunk-recovery"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener("error",function(e){if(e.message&&e.message.indexOf("Loading chunk")>-1&&!window.__chunkReloaded){window.__chunkReloaded=1;window.location.reload();}});`,
          }}
        />
        <Script
          id="inspiration-return-guard"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: `
            (function() {
              try {
                var raw = sessionStorage.getItem('inspiration-return-anim');
                if (raw) {
                  var id = JSON.parse(raw).id;
                  document.body.setAttribute('data-return', id);
                  var s = document.createElement('style');
                  s.textContent = '[data-return] [data-card][data-item-id="' + id + '"]{visibility:hidden!important}';
                  document.head.appendChild(s);
                }
              } catch(e) {}
            })();
          ` }}
        />
        <NavigationProgress />
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
