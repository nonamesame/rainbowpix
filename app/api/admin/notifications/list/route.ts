import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 20;

  // 获取系统通知（user_id = null）
  const { data: notifications, total } = await serverDb
    .collection("notifications")
    .where({ user_id: null })
    .orderBy("created_at", "desc")
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return Response.json({
    items: notifications || [],
    total: total ?? 0,
    page,
    hasMore: page * pageSize < (total ?? 0),
  });
}
