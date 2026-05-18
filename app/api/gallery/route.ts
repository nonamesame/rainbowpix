import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let user: { uid: string };
  try {
    user = JSON.parse(atob(userPayload));
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 12;
  const from = (page - 1) * pageSize;

  const { data } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid })
    .field(["id", "prompt", "model", "image_url", "created_at"])
    .orderBy("created_at", "desc")
    .skip(from)
    .limit(pageSize)
    .get();

  const { total } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid })
    .count();

  return NextResponse.json({
    items: data || [],
    total: total ?? 0,
    page,
    pageSize,
    hasMore: from + pageSize < (total ?? 0),
  });
}
