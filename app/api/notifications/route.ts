import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 20;
  const unreadOnly = searchParams.get("unread_only") === "true";

  // 1. 查询系统通知 (user_id = null)
  const sysWhere: Record<string, unknown> = { user_id: null };
  if (unreadOnly) sysWhere.read = false;
  const { data: sysNotifications } = await serverDb
    .collection("notifications")
    .where(sysWhere)
    .orderBy("created_at", "desc")
    .limit(100)
    .get();

  // 2. 查询用户个人通知
  const userWhere: Record<string, unknown> = { user_id: user.uid };
  if (unreadOnly) userWhere.read = false;
  const { data: userNotifications } = await serverDb
    .collection("notifications")
    .where(userWhere)
    .orderBy("created_at", "desc")
    .limit(100)
    .get();

  // 3. 查询该用户对系统通知的已读记录
  const { data: readRecords } = await serverDb
    .collection("notification_reads")
    .where({ user_id: user.uid })
    .limit(200)
    .get();
  const readIds = new Set((readRecords || []).map((r: { notification_id: string }) => r.notification_id));

  // 4. 合并、标记已读状态、排序
  const all = [
    ...(sysNotifications || []).map((n: any) => ({ ...n, read: readIds.has(n._id) })),
    ...(userNotifications || []),
  ];
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = all.length;
  const unreadCount = all.filter((n) => !n.read).length;
  const items = all.slice((page - 1) * pageSize, page * pageSize);

  return Response.json({
    items,
    total,
    unread_count: unreadCount,
    page,
    hasMore: page * pageSize < total,
  });
}
