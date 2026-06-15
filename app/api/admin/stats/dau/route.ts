import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { checkAdmin } from "@/lib/admin-auth";

/** 获取 UTC+8 的 YYYY-MM-DD 字符串 */
function getTodayDateStr() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const g = (t: string) => parts.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** 获取最近 N 天的日期字符串列表（含今天） */
function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  // 用 UTC+8 计算今天的日期
  const todayStr = getTodayDateStr();
  const today = new Date(`${todayStr}T00:00:00+08:00`);

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const g = (t: string) => parts.find((x) => x.type === t)!.value;
    days.push(`${g("year")}-${g("month")}-${g("day")}`);
  }
  return days;
}

export async function GET(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  try {
    const days = getLastNDays(30);
    const todayStr = getTodayDateStr();

    // === 1. 每日日活（最近30天）===
    // 逐天查询 user_daily_logins 集合中的独立用户数
    const dauData: { date: string; count: number }[] = [];

    for (const day of days) {
      try {
        const dayStart = new Date(`${day}T00:00:00+08:00`).toISOString();
        const nextDay = new Date(`${day}T00:00:00+08:00`);
        nextDay.setDate(nextDay.getDate() + 1);
        const dayEnd = nextDay.toISOString();

        const { total } = await serverDb
          .collection("user_daily_logins")
          .where({
            date: { $gte: dayStart, $lt: dayEnd },
          })
          .count();

        dauData.push({ date: day, count: total ?? 0 });
      } catch {
        dauData.push({ date: day, count: 0 });
      }
    }

    // === 2. 今日密钥兑换总额 ===
    let todayRedeemedCredits = 0;
    try {
      const todayStart = new Date(`${todayStr}T00:00:00+08:00`).toISOString();
      const todayEndObj = new Date(`${todayStr}T00:00:00+08:00`);
      todayEndObj.setDate(todayEndObj.getDate() + 1);
      const todayEnd = todayEndObj.toISOString();

      const { data: redeemedKeys } = await serverDb
        .collection("credit_keys")
        .where({
          used: true,
          used_at: { $gte: todayStart, $lt: todayEnd },
        })
        .limit(1000)
        .get();

      todayRedeemedCredits = (redeemedKeys || []).reduce(
        (sum: number, k: any) => sum + (k.credits || 0),
        0
      );
    } catch {
      todayRedeemedCredits = 0;
    }

    return Response.json({
      dau: dauData,
      todayRedeemedCredits,
    });
  } catch (error) {
    console.error("DAU stats error:", error);
    return Response.json({ error: "获取日活数据失败" }, { status: 500 });
  }
}
