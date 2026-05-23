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

    // 今日统计 - UTC+8 时区
    // 数据库存 UTC ISO 字符串，需要算出 UTC+8 今天 00:00 对应的 UTC 时间
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const g = (t: string) => parts.find((x) => x.type === t)!.value;
    const todayDate = `${g("year")}-${g("month")}-${g("day")}`;
    // +08:00 后缀让 Date 正确解析为 UTC+8 午夜，.toISOString() 转成 UTC
    const todayStartISO = new Date(`${todayDate}T00:00:00+08:00`).toISOString();
    const tomorrowDate = new Date(`${todayDate}T00:00:00+08:00`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrowStartISO = tomorrowDate.toISOString();

    // 今日生成数
    const { total: todayGenerations } = await serverDb
      .collection("generations")
      .where({ created_at: { $gte: todayStartISO, $lt: tomorrowStartISO } })
      .count();

    // 今日新增用户（从 users 集合查询）
    let todayNewUsers = 0;
    try {
      const r = await serverDb
        .collection("users")
        .where({ created_at: { $gte: todayStartISO, $lt: tomorrowStartISO } })
        .count();
      todayNewUsers = r?.total ?? 0;
    } catch {
      // users 集合可能还不存在
      todayNewUsers = 0;
    }

    return Response.json({
      totalUsers,
      totalGenerations: totalGenerations ?? 0,
      todayNewUsers,
      todayGenerations: todayGenerations ?? 0,
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
