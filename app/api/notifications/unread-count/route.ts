import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";

// 缓存每个用户的未读通知数（30 秒 TTL），避免轮询时每次都查询 DB
const UNREAD_COUNT_CACHE_TTL = 30_000;
const unreadCountCache = new Map<string, { count: number; expires: number }>();

function getCachedUnreadCount(userId: string): number | null {
  const cached = unreadCountCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.count;
  }
  if (cached) unreadCountCache.delete(userId);
  return null;
}

export async function GET(request: NextRequest) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ count: 0 });
  }

  // 优先使用缓存
  const cached = getCachedUnreadCount(user.uid);
  if (cached !== null) {
    return Response.json({ count: cached });
  }

  // 系统通知未读数
  const { data: sysNotifications } = await serverDb
    .collection("notifications")
    .where({ user_id: null })
    .orderBy("created_at", "desc")
    .limit(100)
    .get();

  // 已读记录
  const { data: readRecords } = await serverDb
    .collection("notification_reads")
    .where({ user_id: user.uid })
    .limit(200)
    .get();
  const readIds = new Set((readRecords || []).map((r: { notification_id: string }) => r.notification_id));

  const sysUnread = (sysNotifications || []).filter((n: any) => !readIds.has(n._id)).length;

  // 用户个人未读通知
  const { total: userUnread } = await serverDb
    .collection("notifications")
    .where({ user_id: user.uid, read: false })
    .count();

  const count = sysUnread + (userUnread ?? 0);
  unreadCountCache.set(user.uid, { count, expires: Date.now() + UNREAD_COUNT_CACHE_TTL });

  return Response.json({ count });
}
