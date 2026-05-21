import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let user: { uid: string };
  try {
    user = JSON.parse(atob(userPayload));
  } catch {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 12;
  const from = (page - 1) * pageSize;
  const promptFilter = searchParams.get("prompt");
  const sinceParam = searchParams.get("since");

  const whereClause: Record<string, unknown> = { user_id: user.uid };
  if (promptFilter) whereClause.prompt = promptFilter;
  if (sinceParam) whereClause.created_at = { $gte: sinceParam };

  const { data } = await serverDb
    .collection("generations")
    .where(whereClause)
    .field(["prompt", "model", "image_url", "reference_image_url", "created_at"])
    .orderBy("created_at", "desc")
    .skip(from)
    .limit(pageSize)
    .get();

  const { total } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid })
    .count();

  return Response.json({
    items: data || [],
    total: total ?? 0,
    page,
    pageSize,
    hasMore: from + pageSize < (total ?? 0),
  });
}
