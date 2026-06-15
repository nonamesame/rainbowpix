import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";

export async function DELETE(request: NextRequest) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "缺少通知 ID" }, { status: 400 });
  }

  try {
    // 检查通知是否存在且属于该用户（系统通知或个人通知）
    const { data: notification } = await serverDb
      .collection("notifications")
      .doc(id)
      .get();

    if (!notification) {
      return Response.json({ error: "通知不存在" }, { status: 404 });
    }

    // 只能删除自己的通知（系统通知 user_id=null 可被任何人删除，个人通知只能删自己的）
    if (notification.user_id && notification.user_id !== user.uid) {
      return Response.json({ error: "无权删除此通知" }, { status: 403 });
    }

    // 删除通知
    await serverDb.collection("notifications").doc(id).remove();

    // 同时删除该用户的已读记录（如果有）
    const { data: readRecord } = await serverDb
      .collection("notification_reads")
      .where({ user_id: user.uid, notification_id: id })
      .get();

    if (readRecord && readRecord.length > 0) {
      await serverDb.collection("notification_reads").doc(readRecord[0]._id).remove();
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete notification error:", error);
    return Response.json({ error: "删除通知失败" }, { status: 500 });
  }
}
