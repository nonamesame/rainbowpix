import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { addCredits } from "@/lib/credits";

/**
 * POST /api/tasks/checkin
 * 每日签到：首次登录赠送1额度
 */
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const now = new Date();
  // 获取今天日期（北京时间）
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const g = (t: string) => parts.find((x) => x.type === t)!.value;
  const todayDate = `${g("year")}-${g("month")}-${g("day")}`;
  const todayStart = new Date(`${todayDate}T00:00:00+08:00`).toISOString();

  // 检查今天是否已签到
  try {
    const { total } = await serverDb
      .collection("user_task_rewards")
      .where({
        user_id: user.uid,
        task_type: "daily_checkin",
        period: todayDate,
      })
      .count();

    if (total > 0) {
      // 已签到
      const { data } = await serverDb
        .collection("user_credits")
        .where({ user_id: user.uid })
        .limit(1)
        .get();
      return Response.json({
        success: false,
        alreadyCheckedIn: true,
        balance: data?.[0]?.balance ?? 0,
      });
    }
  } catch (err: any) {
    // 集合不存在时继续
    if (!err?.message?.includes("Db or Table not exist")) throw err;
  }

  // 执行签到：记录 + 增加额度
  try {
    await serverDb.collection("user_task_rewards").add({
      user_id: user.uid,
      task_type: "daily_checkin",
      period: todayDate,
      claimed: true,
      created_at: now.toISOString(),
    });
  } catch (err: any) {
    if (!err?.message?.includes("Db or Table not exist")) throw err;
  }

  const result = await addCredits(user.uid, 1);

  return Response.json({
    success: true,
    balance: result.balance ?? 0,
  });
}
