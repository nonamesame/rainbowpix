import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

interface TaskStatus {
  type: string;
  title: string;
  description: string;
  reward: number;
  period: "daily" | "weekly" | "once";
  completed: boolean;
  claimed: boolean;
  weeklyCount?: number; // 获赞任务本周已领取次数
  weeklyLimit?: number; // 获赞任务每周上限
}

/** 获取本周一的 ISO 时间戳 */
function getWeekStart(now: Date): string {
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

/**
 * GET /api/tasks/status
 * 获取所有任务的完成状态和领取状态
 */
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const g = (t: string) => parts.find((x) => x.type === t)!.value;
  const todayDate = `${g("year")}-${g("month")}-${g("day")}`;
  const todayStart = new Date(`${todayDate}T00:00:00+08:00`).toISOString();

  // 获取本周标识 (YYYY-Www)
  const weekParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(now);
  const year = weekParts.find((x) => x.type === "year")!.value;
  // 计算本周第几周
  const startOfYear = new Date(`${year}-01-01T00:00:00+08:00`);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  const weekId = `${year}-W${String(weekNumber).padStart(2, "0")}`;

  // 1. 检查签到状态
  let checkinCompleted = false;
  let checkinClaimed = false;
  try {
    const { data } = await serverDb
      .collection("user_task_rewards")
      .where({
        user_id: user.uid,
        task_type: "daily_checkin",
        period: todayDate,
      })
      .limit(1)
      .get();
    if (data && data.length > 0) {
      checkinCompleted = true;
      checkinClaimed = data[0].claimed;
    }
  } catch {}

  // 2. 检查点赞+评论任务（每个作品只能领一次）
  let likeCommentCompleted = false;
  let likeCommentClaimed = false;
  try {
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

    likeCommentCompleted = availableWorks.length > 0 && todayClaimed === 0;
    likeCommentClaimed = todayClaimed > 0;
  } catch {}

  // 3. 检查发布作品任务（每个作品只能领一次发布奖励）
  let publishCompleted = false;
  let publishClaimed = false;
  try {
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

    // 检查是否有未领取过奖励的已发布作品
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

    publishCompleted = availableWorks.length > 0 && todayPublishClaimed === 0;
    publishClaimed = todayPublishClaimed > 0;
  } catch {}

  // 4. 检查单作品30赞任务（每个作品只能领一次，每周最多5次）
  let work30LikesCompleted = false;
  let work30LikesClaimed = false;
  let work30LikesWeeklyCount = 0;
  const WEEKLY_LIKE_LIMIT = 5;
  try {
    // 查所有达到30赞的作品
    const { data: works } = await serverDb
      .collection("generations")
      .where({
        user_id: user.uid,
        likes_count: serverDb.command.gte(30),
      })
      .field(["_id", "likes_count"])
      .get();

    // 查已领取过的作品ID列表（不限时间，永久记录）
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

    // 检查是否有未使用过的30赞作品
    const availableWorks = (works || []).filter(
      (w: any) => !claimedGenIds.has(w._id)
    );

    // 查本周已领取次数
    const weekStart = getWeekStart(now);
    const { total: weeklyCount } = await serverDb
      .collection("user_task_rewards")
      .where({
        user_id: user.uid,
        task_type: "work_30likes",
        created_at: serverDb.command.gte(weekStart),
      })
      .count();

    work30LikesWeeklyCount = weeklyCount ?? 0;
    // 有可用作品 且 本周未达上限
    work30LikesCompleted = availableWorks.length > 0 && work30LikesWeeklyCount < WEEKLY_LIKE_LIMIT;
    work30LikesClaimed = false;
  } catch {}

  const tasks: TaskStatus[] = [
    {
      type: "daily_checkin",
      title: "每日签到",
      description: "每日首次登录自动签到",
      reward: 1,
      period: "daily",
      completed: checkinCompleted,
      claimed: checkinClaimed,
    },
    {
      type: "daily_like_comment",
      title: "点赞并评论他人作品",
      description: "每日点赞并评论1个他人作品",
      reward: 1,
      period: "daily",
      completed: likeCommentCompleted,
      claimed: likeCommentClaimed,
    },
    {
      type: "daily_publish",
      title: "发布一个作品",
      description: "每日发布1个作品到灵感大厅",
      reward: 1,
      period: "daily",
      completed: publishCompleted,
      claimed: publishClaimed,
    },
    {
      type: "work_30likes",
      title: "单作品获得30赞",
      description: "任意一个作品累计获得30个赞",
      reward: 1,
      period: "once",
      completed: work30LikesCompleted,
      claimed: work30LikesClaimed,
      weeklyCount: work30LikesWeeklyCount,
      weeklyLimit: WEEKLY_LIKE_LIMIT,
    },
  ];

  // 是否有可领取的奖励（红点判断依据）
  const hasUnclaimedTasks = tasks.some((t) => t.completed && !t.claimed);
  const hasUncompletedTasks = tasks.some((t) => !t.completed && !t.claimed);

  return Response.json({
    tasks,
    hasUnclaimedTasks,
    hasUncompletedTasks,
  });
}
