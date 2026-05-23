import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ count: 0 });
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

  return Response.json({ count: sysUnread + (userUnread ?? 0) });
}
