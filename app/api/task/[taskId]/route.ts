import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { runTask } from "@/lib/task-runner";

// GET: 查询任务状态
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

    if (task.user_id !== user.uid) {
      return Response.json({ error: "无权访问" }, { status: 403 });
    }

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

// POST: 触发执行任务（客户端主动调用，不依赖 after()）
export async function POST(
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

    if (task.user_id !== user.uid) {
      return Response.json({ error: "无权访问" }, { status: 403 });
    }

    // 只有 pending 状态的任务才能触发执行
    if (task.status !== "pending") {
      return Response.json({
        task_id: taskId,
        status: task.status,
        image_url: task.image_url,
        generation_id: task.generation_id,
        error: task.error,
      });
    }

    // 触发执行（在当前请求内同步完成）
    await runTask({
      taskId,
      userId: user.uid,
      prompt: task.prompt,
      model: task.model,
      width: task.width,
      height: task.height,
      idempotencyKey: task.idempotency_key,
      creditCost: task.credit_cost || 0,
      creditDeducted: task.credit_deducted || false,
      referenceImageFileIds: task.reference_image_file_ids || undefined,
    });

    // 返回执行结果
    const { data: updatedTask } = await serverDb
      .collection("generation_tasks")
      .doc(taskId)
      .get();

    return Response.json({
      task_id: taskId,
      status: updatedTask?.status || "running",
      image_url: updatedTask?.image_url,
      generation_id: updatedTask?.generation_id,
      error: updatedTask?.error,
    });
  } catch (error: any) {
    console.error("[task] Run error:", error?.message);
    return Response.json({ error: "执行任务失败" }, { status: 500 });
  }
}
