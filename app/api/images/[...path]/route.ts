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

/**
 * 修正 CloudBase fileID 格式
 * URL 编码/解码过程中 cloud://xxx 可能变成 cloud:/xxx（少一个斜杠）
 * CloudBase 要求 fileID 必须是 cloud:// 开头
 */
function fixCloudBaseFileId(fileID: string): string {
  // "cloud:/xxx" → "cloud://xxx"（但不要把已经是 cloud://xxx 的变成 cloud:///xxx）
  if (/^cloud:\/[^/]/.test(fileID)) {
    return "cloud:/" + fileID.slice(6); // "cloud:/" + "/xxx" = "cloud://xxx"
  }
  return fileID;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const rawFileID = decodeURIComponent(segments.join("/"));
  const fileID = fixCloudBaseFileId(rawFileID);

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
        console.error("[image-proxy] FAILED:", fileID.substring(0, 80), JSON.stringify(item).substring(0, 200));
        return Response.json({ error: "Image not found", detail: item }, { status: 404 });
      }

      downloadUrl = item.download_url as string;
      setCachedTempUrl(fileID, downloadUrl);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: downloadUrl,
        "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("[image-proxy] error:", fileID.substring(0, 80), error);
    return Response.json({ error: "Image not found" }, { status: 500 });
  }
}
