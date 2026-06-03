import { NextRequest } from "next/server";
import app from "@/lib/cloudbase/server";

// 服务端缓存 getTempFileURL 结果，避免同一文件重复请求 CloudBase
// CloudBase 临时链接有效期通常 15 分钟，我们缓存 10 分钟
const TEMP_URL_CACHE_TTL = 10 * 60 * 1000;
const tempUrlCache = new Map<string, { url: string; expires: number }>();

function getCachedTempUrl(fileID: string): string | null {
  const cached = tempUrlCache.get(fileID);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }
  if (cached) tempUrlCache.delete(fileID);
  return null;
}

function setCachedTempUrl(fileID: string, url: string) {
  // 限制缓存大小，避免内存泄漏
  if (tempUrlCache.size > 500) {
    const oldest = tempUrlCache.keys().next().value;
    if (oldest) tempUrlCache.delete(oldest);
  }
  tempUrlCache.set(fileID, { url, expires: Date.now() + TEMP_URL_CACHE_TTL });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const fileID = decodeURIComponent(segments.join("/"));

  if (!fileID) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    // 优先使用缓存的临时 URL
    let downloadUrl: string | null = getCachedTempUrl(fileID);

    if (!downloadUrl) {
      const urlRes = await app.getTempFileURL({ fileList: [fileID] });
      const fileList = (urlRes as any).fileList || [];
      const item = fileList[0];

      if (!item || item.code !== "SUCCESS" || !item.download_url) {
        console.error("[image-proxy] getTempFileURL failed:", JSON.stringify(item));
        return Response.json({ error: "Image not found" }, { status: 404 });
      }

      downloadUrl = item.download_url as string;
      setCachedTempUrl(fileID, downloadUrl);
    }

    // 直接返回 302 重定向到临时 URL，让客户端直接从 CloudBase 加载
    // 这样避免服务端代理整个图片，大幅提升加载速度
    return Response.redirect(downloadUrl, 302);
  } catch (error) {
    console.error("[image-proxy] error:", error);
    return Response.json({ error: "Image not found" }, { status: 404 });
  }
}
