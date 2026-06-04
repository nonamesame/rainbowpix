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

  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[image-proxy][${requestId}] ─── 新请求 ───`);
  console.log(`[image-proxy][${requestId}] URL:`, request.url);
  console.log(`[image-proxy][${requestId}] segments:`, JSON.stringify(segments));
  console.log(`[image-proxy][${requestId}] rawFileID:`, rawFileID);
  console.log(`[image-proxy][${requestId}] fileID:`, fileID);
  console.log(`[image-proxy][${requestId}] Referer:`, request.headers.get("referer") || "none");

  if (!fileID) {
    console.error(`[image-proxy][${requestId}] ERROR: empty fileID`);
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    // 优先使用缓存的临时 URL
    let downloadUrl: string | null = getCachedTempUrl(fileID);

    if (downloadUrl) {
      console.log(`[image-proxy][${requestId}] 命中缓存 → 302 redirect`);
      console.log(`[image-proxy][${requestId}] redirect URL:`, downloadUrl.substring(0, 120));
      return Response.redirect(downloadUrl, 302);
    }

    console.log(`[image-proxy][${requestId}] 缓存未命中，调用 CloudBase getTempFileURL...`);
    const urlRes = await app.getTempFileURL({ fileList: [fileID] });
    const fileList = (urlRes as any).fileList || [];
    const item = fileList[0];

    console.log(`[image-proxy][${requestId}] CloudBase response code:`, item?.code);
    console.log(`[image-proxy][${requestId}] CloudBase download_url:`, item?.download_url?.substring(0, 150));
    console.log(`[image-proxy][${requestId}] CloudBase full item:`, JSON.stringify(item).substring(0, 300));

    if (!item || item.code !== "SUCCESS" || !item.download_url) {
      console.error(`[image-proxy][${requestId}] FAILED - code: ${item?.code}, errMsg: ${item?.errMsg || "none"}`);
      console.error(`[image-proxy][${requestId}] FAILED - full response:`, JSON.stringify(urlRes).substring(0, 500));
      return Response.json({ error: "Image not found", detail: item }, { status: 404 });
    }

    downloadUrl = item.download_url as string;
    setCachedTempUrl(fileID, downloadUrl);

    console.log(`[image-proxy][${requestId}] 成功 → 302 redirect`);
    console.log(`[image-proxy][${requestId}] redirect URL:`, downloadUrl.substring(0, 150));

    return Response.redirect(downloadUrl, 302);
  } catch (error: any) {
    console.error(`[image-proxy][${requestId}] EXCEPTION:`, error?.message || error);
    console.error(`[image-proxy][${requestId}] STACK:`, error?.stack?.substring(0, 300));
    return Response.json({ error: "Image not found" }, { status: 500 });
  }
}
