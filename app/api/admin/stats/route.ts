import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  try {
    // 总生成数
    const { total: totalGenerations } = await serverDb
      .collection("generations")
      .count();

    // 获取所有生成记录的 user_id
    const { data: allGenerations } = await serverDb
      .collection("generations")
      .field({ user_id: true })
      .limit(10000)
      .get();

    const allUserIds = new Set((allGenerations || []).map((g: any) => g.user_id));
    const totalUsers = allUserIds.size;

    return Response.json({
      totalUsers,
      totalGenerations: totalGenerations ?? 0,
      todayNewUsers: 0,
      todayGenerations: 0,
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
