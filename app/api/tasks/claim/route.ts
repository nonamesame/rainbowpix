import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { addCredits } from "@/lib/credits";

const TASK_REWARDS: Record<string, { amount: number; period: "daily" | "once" }> = {
  daily_checkin: { amount: 1, period: "daily" },
  daily_like_comment: { amount: 1, period: "daily" },
  daily_publish: { amount: 1, period: "daily" },
  work_30likes: { amount: 1, period: "once" },
};

/** 获取本周一的 ISO 时间戳 */
function getWeekStart(now: Date): string {
  const day = now.getDay() || 7; // 周日为7
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

/**
 * POST /api/tasks/claim
 * 领取任务奖励
 * Body: { task_type: string }
 */
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let body: { task_type?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { task_type } = body;
  if (!task_type || !TASK_REWARDS[task_type]) {
    return Response.json({ error: "无效的任务类型" }, { status: 400 });
  }

  const taskConfig = TASK_REWARDS[task_type];
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const g = (t: string) => parts.find((x) => x.type === t)!.value;
  const todayDate = `${g("year")}-${g("month")}-${g("day")}`;

  // 计算周标识
  const weekParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(now);
  const year = weekParts.find((x) => x.type === "year")!.value;
  const startOfYear = new Date(`${year}-01-01T00:00:00+08:00`);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  const weekId = `${year}-W${String(weekNumber).padStart(2, "0")}`;

  const period = taskConfig.period === "daily" ? todayDate : "once";

  // "once" 类型的任务不检查 period，而是在下面验证时检查 generation_id
  if (task_type !== "work_30likes") {
    try {
      const { total } = await serverDb
        .collection("user_task_rewards")
        .where({
          user_id: user.uid,
          task_type,
          period,
        })
        .count();

      if (total > 0) {
        return Response.json({ error: "已领取过该奖励" }, { status: 400 });
      }
    } catch (err: any) {
      if (!err?.message?.includes("Db or Table not exist")) throw err;
    }
  } else {
    // 获赞任务：检查本周领取次数是否已达上限（5次/周）
    const weekStart = getWeekStart(now);
    const { total: weeklyCount } = await serverDb
      .collection("user_task_rewards")
      .where({
        user_id: user.uid,
        task_type: "work_30likes",
        created_at: serverDb.command.gte(weekStart),
      })
      .count();

    if (weeklyCount >= 5) {
      return Response.json({ error: "本周获赞奖励已达上限（5次）" }, { status: 400 });
    }
  }

  // 验证任务是否完成
  let isCompleted = false;
  let selectedGenerationId: string | null = null;
  const todayStart = new Date(`${todayDate}T00:00:00+08:00`).toISOString();

  try {
    switch (task_type) {
      case "daily_checkin": {
        // 签到任务：检查是否已签到
        const { total } = await serverDb
          .collection("user_task_rewards")
          .where({
            user_id: user.uid,
            task_type: "daily_checkin",
            period: todayDate,
          })
          .count();
        isCompleted = total > 0;
        break;
      }
      case "daily_like_comment": {
        // 查今天点赞过的他人作品ID
        const { data: todayLikes } = await serverDb
          .collection("gallery_likes")
          .where({
            user_id: user.uid,
            created_at: serverDb.command.gte(todayStart),
          })
          .field(["generation_id"])
          .get();

        // 查今天评论过的他人作品ID
        const { data: todayComments } = await serverDb
          .collection("gallery_comments")
          .where({
            user_id: user.uid,
            created_at: serverDb.command.gte(todayStart),
          })
          .field(["generation_id"])
          .get();

        const likedGenIds = new Set(
          (todayLikes || []).map((l: any) => l.generation_id).filter(Boolean)
        );
        const commentedGenIds = new Set(
          (todayComments || []).map((c: any) => c.generation_id).filter(Boolean)
        );

        // 找今天既点赞又评论过的他人作品
        const completedGenIds = [...likedGenIds].filter((id) => commentedGenIds.has(id));

        // 查已领取过奖励的作品ID
        const { data: claimedRewards } = await serverDb
          .collection("user_task_rewards")
          .where({
            user_id: user.uid,
            task_type: "daily_like_comment",
          })
          .field(["generation_id"])
          .get();

        const claimedGenIdSet = new Set(
          (claimedRewards || []).map((r: any) => r.generation_id).filter(Boolean)
        );

        // 找未领取过奖励的已完成作品
        const availableWorks = completedGenIds.filter((id) => !claimedGenIdSet.has(id));

        // 查今天是否已领取过（每天只能领1次）
        const { total: todayClaimed } = await serverDb
          .collection("user_task_rewards")
          .where({
            user_id: user.uid,
            task_type: "daily_like_comment",
            period: todayDate,
          })
          .count();

        if (availableWorks.length > 0 && todayClaimed === 0) {
          selectedGenerationId = availableWorks[0];
          isCompleted = true;
        }
        break;
      }
      case "daily_publish": {
        // 查今天发布的作品
        const { data: publishedWorks } = await serverDb
          .collection("generations")
          .where({
            user_id: user.uid,
            published: true,
            published_at: serverDb.command.gte(todayStart),
          })
          .field(["_id"])
          .get();

        // 查已领取过发布奖励的作品ID
        const { data: claimedRewards } = await serverDb
          .collection("user_task_rewards")
          .where({
            user_id: user.uid,
            task_type: "daily_publish",
          })
          .field(["generation_id"])
          .get();

        const claimedGenIds = new Set(
          (claimedRewards || []).map((r: any) => r.generation_id).filter(Boolean)
        );

        // 找一个未领取过奖励的已发布作品
        const availableWorks = (publishedWorks || []).filter(
          (w: any) => !claimedGenIds.has(w._id)
        );

        // 查今天是否已领取过（每天只能领1次）
        const { total: todayPublishClaimed } = await serverDb
          .collection("user_task_rewards")
          .where({
            user_id: user.uid,
            task_type: "daily_publish",
            period: todayDate,
          })
          .count();

        if (availableWorks.length > 0 && todayPublishClaimed === 0) {
          selectedGenerationId = availableWorks[0]._id;
          isCompleted = true;
        }
        break;
      }
      case "work_30likes": {
        // 查所有达到30赞的作品
        const { data: works } = await serverDb
          .collection("generations")
          .where({
            user_id: user.uid,
            likes_count: serverDb.command.gte(30),
          })
          .field(["_id", "likes_count"])
          .get();

        // 查已领取过的作品ID（不限时间，永久记录）
        const { data: claimedRewards } = await serverDb
          .collection("user_task_rewards")
          .where({
            user_id: user.uid,
            task_type: "work_30likes",
          })
          .field(["generation_id"])
          .get();

        const claimedGenIds = new Set(
          (claimedRewards || []).map((r: any) => r.generation_id).filter(Boolean)
        );

        // 找一个未使用过的30赞作品
        const availableWorks = (works || []).filter(
          (w: any) => !claimedGenIds.has(w._id)
        );

        if (availableWorks.length > 0) {
          // 记录使用的 generation_id
          selectedGenerationId = availableWorks[0]._id;
          isCompleted = true;
        }
        break;
      }
    }
  } catch {}

  if (!isCompleted) {
    return Response.json({ error: "任务未完成" }, { status: 400 });
  }

  // 记录领取（先写入，再检查是否重复，并发情况下只有第一个请求能成功）
  let rewardDocId: string | null = null;
  try {
    const rewardData: Record<string, any> = {
      user_id: user.uid,
      task_type,
      period,
      claimed: true,
      created_at: now.toISOString(),
    };
    // 获赞/发布任务需要记录使用的作品ID
    if (selectedGenerationId) {
      rewardData.generation_id = selectedGenerationId;
    }
    const addResult = await serverDb.collection("user_task_rewards").add(rewardData);
    rewardDocId = addResult.id;
  } catch (err: any) {
    if (!err?.message?.includes("Db or Table not exist")) throw err;
  }

  // 写入后检查是否重复（防止并发重复领取）
  try {
    if (selectedGenerationId && (task_type === "work_30likes" || task_type === "daily_publish" || task_type === "daily_like_comment")) {
      // 获赞/发布/点赞评论任务：检查同一作品是否已被领取
      const { total } = await serverDb
        .collection("user_task_rewards")
        .where({
          user_id: user.uid,
          task_type,
          generation_id: selectedGenerationId,
        })
        .count();
      if (total > 1) {
        // 重复了，删除当前记录，拒绝发放
        if (rewardDocId) {
          await serverDb.collection("user_task_rewards").doc(rewardDocId).delete();
        }
        return Response.json({ error: "该作品已领取过奖励" }, { status: 400 });
      }
    } else {
      // 日任务：检查是否已有相同记录
      const { total } = await serverDb
        .collection("user_task_rewards")
        .where({
          user_id: user.uid,
          task_type,
          period,
        })
        .count();
      if (total > 1) {
        // 重复了，删除当前记录，拒绝发放
        if (rewardDocId) {
          await serverDb.collection("user_task_rewards").doc(rewardDocId).delete();
        }
        return Response.json({ error: "已领取过该奖励" }, { status: 400 });
      }
    }
  } catch (err: any) {
    if (!err?.message?.includes("Db or Table not exist")) throw err;
  }

  // 发放奖励
  const result = await addCredits(user.uid, taskConfig.amount);

  return Response.json({
    success: true,
    balance: result.balance ?? 0,
    credits_added: taskConfig.amount,
  });
}
