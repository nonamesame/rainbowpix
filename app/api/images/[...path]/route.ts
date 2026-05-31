import { NextRequest } from "next/server";
import app from "@/lib/cloudbase/server";
import axios from "axios";

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
  _request: NextRequest,
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

    const imgResponse = await axios.get(downloadUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imgResponse.data);

    const ext = fileID.split(".").pop()?.toLowerCase() || "png";
    const contentType =
      { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[ext] || "image/png";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (error) {
    console.error("[image-proxy] error:", error);
    return Response.json({ error: "Image not found" }, { status: 404 });
  }
}
