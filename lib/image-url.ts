const TCB_DIRECT_RE = /^https?:\/\/[^/]+\.tcloudbaseapp\.com\/(.+)$/;

export function toProxyUrl(url: string): string {
  const m = url.match(TCB_DIRECT_RE);
  if (m) {
    return `/api/images/${m[1]}`;
  }
  return url;
}
