import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

export async function DELETE(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "缺少通知 ID" }, { status: 400 });
  }

  try {
    await serverDb.collection("notifications").doc(id).remove();
    await logAdminAction("delete_notification", { id }, request);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete notification error:", error);
    return Response.json({ error: "删除通知失败" }, { status: 500 });
  }
}
