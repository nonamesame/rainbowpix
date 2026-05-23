import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function DELETE(request: NextRequest) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "缺少通知 ID" }, { status: 400 });
  }

  try {
    await serverDb.collection("notifications").doc(id).remove();
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
