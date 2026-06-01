import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { checkAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  try {
    // 总用户数（从 users 集合查询，不算后台创建的作者）
    let totalUsers = 0;
    try {
      const usersResult = await serverDb.collection("users").count();
      totalUsers = usersResult?.total ?? 0;
    } catch {
      totalUsers = 0;
    }

    // 总生成数（AI 生成的，兼容旧数据：没有 source 字段的也算 AI 生成）
    const { total: totalGenerations } = await serverDb
      .collection("generations")
      .where({ $or: [{ source: "ai" }, { source: "" }, { source: null }] })
      .count();

    // 今日统计 - UTC+8 时区
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const g = (t: string) => parts.find((x) => x.type === t)!.value;
    const todayDate = `${g("year")}-${g("month")}-${g("day")}`;
    const todayStartISO = new Date(`${todayDate}T00:00:00+08:00`).toISOString();
    const tomorrowDate = new Date(`${todayDate}T00:00:00+08:00`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrowStartISO = tomorrowDate.toISOString();

    // 今日生成数（AI 生成的，兼容旧数据）
    const { total: todayGenerations } = await serverDb
      .collection("generations")
      .where({
        $or: [{ source: "ai" }, { source: "" }, { source: null }],
        created_at: { $gte: todayStartISO, $lt: tomorrowStartISO },
      })
      .count();

    // 今日新增用户
    let todayNewUsers = 0;
    try {
      const r = await serverDb
        .collection("users")
        .where({ created_at: { $gte: todayStartISO, $lt: tomorrowStartISO } })
        .count();
      todayNewUsers = r?.total ?? 0;
    } catch {
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
