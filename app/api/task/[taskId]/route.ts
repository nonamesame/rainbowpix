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

  try {
    const { data } = await serverDb
      .collection("generation_tasks")
      .doc(taskId)
      .get();

    if (!data) {
      return Response.json({ error: "任务不存在" }, { status: 404 });
    }

    if (data.user_id !== user.uid) {
      return Response.json({ error: "无权访问" }, { status: 403 });
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
