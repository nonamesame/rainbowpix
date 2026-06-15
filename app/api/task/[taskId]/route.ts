import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const { taskId } = await params;

  try {
    const { data: task } = await serverDb
      .collection("generation_tasks")
      .doc(taskId)
      .get();

    if (!task) {
      return Response.json({ error: "任务不存在" }, { status: 404 });
    }

    // 只能查询自己的任务
    if (task.user_id !== user.uid) {
      return Response.json({ error: "无权访问" }, { status: 403 });
    }

    // 返回任务状态
    const response: Record<string, unknown> = {
      task_id: taskId,
      status: task.status,
      created_at: task.created_at,
    };

    if (task.status === "completed") {
      response.image_url = task.image_url;
      response.generation_id = task.generation_id;
    } else if (task.status === "failed") {
      response.error = task.error || "生成失败，请稍后重试";
    }

    return Response.json(response);
  } catch (error: any) {
    console.error("[task] Query error:", error?.message);
    return Response.json({ error: "查询任务状态失败" }, { status: 500 });
  }
}
