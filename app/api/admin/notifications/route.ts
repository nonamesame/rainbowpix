import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

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

  return Response.json({ id, title }, { status: 201 });
}
