import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  const body = await request.json();
  const { title, body: content, link, type, image } = body;

  if (!title || !content) {
    return Response.json({ error: "缺少必要参数 (title, body)" }, { status: 400 });
  }

  const { id } = await serverDb.collection("notifications").add({
    user_id: null,
    type: type || "system",
    title,
    body: content,
    link: link || null,
    image: image || null,
    read: false,
    created_at: new Date().toISOString(),
  });

  await logAdminAction("send_notification", { title, type: type || "system" }, request);

  return Response.json({ id, title }, { status: 201 });
}
