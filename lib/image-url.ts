const TCB_DIRECT_RE = /^https?:\/\/[^/]+\.tcloudbaseapp\.com\/(.+)$/;

export function toProxyUrl(url: string): string {
  const m = url.match(TCB_DIRECT_RE);
  if (m) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    return `${siteUrl}/api/images/${m[1]}`;
  }
  return url;
}
