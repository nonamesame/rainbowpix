const TCB_DIRECT_RE = /^https?:\/\/[^/]+\.tcloudbaseapp\.com\/(.+)$/;
// 匹配 http://localhost:3000/api/images/... 或任意域名的 /api/images/... 绝对 URL
const ABSOLUTE_API_IMAGES_RE = /^https?:\/\/[^/]+(\/api\/images\/.+)$/;

export function toProxyUrl(url: string): string {
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
