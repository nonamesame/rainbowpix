import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

/**
 * GET /api/task/{task_id}
 * 客户端轮询此接口获取异步生图任务状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { taskId } = await params;
  const { searchParams } = new URL(request.url);
  const checkGeneration = searchParams.get("check_generation") === "1";

  const t0 = Date.now();
  console.log(`[task] poll taskId=${taskId} checkGen=${checkGeneration} uid=${user.uid}`);

  try {
    const { data } = await serverDb
      .collection("generation_tasks")
      .doc(taskId)
      .get();

    if (!data) {
      console.log(`[task] not found taskId=${taskId} t=${Date.now() - t0}ms`);
      return Response.json({ error: "任务不存在" }, { status: 404 });
    }

    if (data.user_id !== user.uid) {
      return Response.json({ error: "无权访问" }, { status: 403 });
    }

    console.log(`[task] status=${data.status} taskId=${taskId} t=${Date.now() - t0}ms`);

    // 兜底：如果任务卡在 pending，查 generations 集合看有没有最新图片
    if (checkGeneration && (data.status === "pending" || !data.status)) {
      const { data: gens } = await serverDb
        .collection("generations")
        .where({ user_id: user.uid })
        .order("created_at", "desc")
        .limit(1)
        .get();
      const latest = gens?.[0];
      if (latest && latest.created_at) {
        const genTime = new Date(latest.created_at).getTime();
        const taskTime = new Date(data.created_at).getTime();
        // 最新 generation 在任务创建之后，说明图片已生成但任务状态未更新
        if (genTime >= taskTime) {
          console.log(`[task] fallback-compensate taskId=${taskId} genTime=${latest.created_at} t=${Date.now() - t0}ms`);
          // 补偿：更新任务状态
          await serverDb.collection("generation_tasks").doc(taskId).update({
            status: "completed",
            image_url: latest.image_url,
            generation_id: latest._id,
            width: latest.width,
            height: latest.height,
            completed_at: new Date().toISOString(),
          });
          return Response.json({
            status: "completed",
            image_url: latest.image_url,
            generation_id: latest._id,
            width: latest.width,
            height: latest.height,
          });
        }
      }
    }

    return Response.json({
      status: data.status,
      image_url: data.image_url,
      generation_id: data.generation_id,
      error: data.error,
      width: data.width,
      height: data.height,
    });
  } catch (err: any) {
    console.error("[task] query error:", err?.message);
    return Response.json({ error: "查询失败" }, { status: 500 });
  }
}
