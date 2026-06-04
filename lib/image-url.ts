const TCB_DIRECT_RE = /^https?:\/\/[^/]+\.tcloudbaseapp\.com\/(.+)$/;
// 匹配 http://localhost:3000/api/images/... 或任意域名的 /api/images/... 绝对 URL
const ABSOLUTE_API_IMAGES_RE = /^https?:\/\/[^/]+(\/api\/images\/.+)$/;

// ========== 客户端临时 URL 缓存 ==========
const TEMP_URL_CACHE_TTL = 10 * 60 * 1000; // 10 分钟
const tempUrlCache = new Map<string, { url: string; expires: number }>();

/**
 * 从各种格式的 URL 中提取 CloudBase fileID
 * 支持：/api/images/cloud%3A%2F...、/api/images/cloud://...、https://xxx.tcloudbaseapp.com/...
 */
function extractFileID(url: string): string | null {
  // /api/images/{encoded-fileID}
  const apiMatch = url.match(/^\/api\/images\/(.+)$/);
  if (apiMatch) {
    try { return decodeURIComponent(apiMatch[1]); } catch { return apiMatch[1]; }
  }
  // /api/images/... 绝对 URL
  const absApiMatch = url.match(ABSOLUTE_API_IMAGES_RE);
  if (absApiMatch) {
    try { return decodeURIComponent(absApiMatch[1].replace(/^\/api\/images\//, "")); } catch { return null; }
  }
  // CloudBase 直链
  const tcbMatch = url.match(TCB_DIRECT_RE);
  if (tcbMatch) {
    return `cloud://${tcbMatch[1]}`;
  }
  return null;
}

/**
 * 批量预解析图片 URL —— 调用客户端 CloudBase SDK 获取临时下载链接
 * 在页面加载数据后调用一次，后续 toProxyUrl 会直接返回 CDN 地址
 */
export async function resolveImageUrls(urls: string[]): Promise<void> {
  if (typeof window === "undefined") return;

  const fileIDs = urls
    .map((u) => extractFileID(u))
    .filter((id): id is string => {
      if (!id) return false;
      const cached = tempUrlCache.get(id);
      return !cached || cached.expires <= Date.now();
    });

  if (fileIDs.length === 0) return;

  try {
    const { getStorage } = await import("@/lib/cloudbase/client");
    const storage = getStorage();

    // CloudBase 每批最多 50 个
    for (let i = 0; i < fileIDs.length; i += 50) {
      const batch = fileIDs.slice(i, i + 50);
      const res = await storage.getTempFileURL({ fileList: batch });
      for (const item of (res as any).fileList || []) {
        if (item.code === "SUCCESS" && item.tempFileURL) {
          tempUrlCache.set(item.fileID, {
            url: item.tempFileURL,
            expires: Date.now() + TEMP_URL_CACHE_TTL,
          });
        }
      }
    }
  } catch (e) {
    console.warn("[resolveImageUrls] failed:", e);
  }
}

export function toProxyUrl(url: string): string {
  // 优先查客户端缓存
  const fileID = extractFileID(url);
  if (fileID) {
    const cached = tempUrlCache.get(fileID);
    if (cached && cached.expires > Date.now()) return cached.url;
  }

  // 降级：走 serverless 代理
  // CloudBase 直链 → 代理
  const m = url.match(TCB_DIRECT_RE);
  if (m) {
    return `/api/images/${m[1]}`;
  }
  // localhost 或其他域名的绝对 URL → 提取相对路径
  const apiMatch = url.match(ABSOLUTE_API_IMAGES_RE);
  if (apiMatch) {
    return apiMatch[1]; // e.g. "/api/images/cloud%3A%2F%2F..."
  }
  return url;
}
