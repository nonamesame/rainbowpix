import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { ids, mark_all } = body;

  if (mark_all) {
    // 标记所有用户个人通知为已读
    const { data: userNotifications } = await serverDb
      .collection("notifications")
      .where({ user_id: user.uid, read: false })
      .get();

    if (userNotifications?.length) {
      for (const n of userNotifications) {
        await serverDb.collection("notifications").doc(n._id).update({ read: true });
      }
    }

    // 标记所有系统通知为已读（插入 notification_reads 记录）
    const { data: sysNotifications } = await serverDb
      .collection("notifications")
      .where({ user_id: null })
      .get();

    if (sysNotifications?.length) {
      const { data: existingReads } = await serverDb
        .collection("notification_reads")
        .where({ user_id: user.uid })
        .get();
      const existingIds = new Set((existingReads || []).map((r: { notification_id: string }) => r.notification_id));

      for (const n of sysNotifications) {
        if (!existingIds.has(n._id)) {
          await serverDb.collection("notification_reads").add({
            user_id: user.uid,
            notification_id: n._id,
          });
        }
      }
    }

    return Response.json({ success: true });
  }

  if (Array.isArray(ids) && ids.length > 0) {
    // 标记指定通知为已读
    for (const id of ids) {
      // 使用 where 查询而不是 doc(id).get()，更可靠
      const { data: notifications } = await serverDb
        .collection("notifications")
        .where({ _id: id })
        .get();

      const notification = notifications?.[0];

      if (notification && notification.user_id === null) {
        // 系统通知：插入 notification_reads
        const { data: existing } = await serverDb
          .collection("notification_reads")
          .where({ user_id: user.uid, notification_id: id })
          .get();
        if (!existing?.length) {
          await serverDb.collection("notification_reads").add({
            user_id: user.uid,
            notification_id: id,
          });
        }
      } else if (notification) {
        // 个人通知：直接更新 read 字段
        await serverDb.collection("notifications").doc(id).update({ read: true });
      }
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "缺少 ids 或 mark_all 参数" }, { status: 400 });
}
