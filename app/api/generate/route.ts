import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import app, { serverDb } from "@/lib/cloudbase/server";
import { checkPrompt } from "@/lib/security";
import { getPixelSize, models } from "@/lib/models";
import { deductCredits, isIdempotentProcessed } from "@/lib/credits";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  let user: { uid: string; email?: string } | undefined;
  let creditDeducted = false;
  let creditCost = 0;
  let idempotencyKey = "";

  try {
    // 1. 验证用户身份
    user = getUserFromRequest(request) as { uid: string; email?: string } | undefined;
    if (!user) {
      return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
    }

    // 2. 解析 FormData
    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const model = (formData.get("model") as string) || "z-image-turbo";
    const aspectRatio = (formData.get("aspect_ratio") as string) || "1:1";
    const { w: width, h: height } = getPixelSize(aspectRatio, model);
    const referenceImageFiles = formData.getAll("reference_image") as File[];

    // 2.1 拒绝已隐藏的模型
    const modelConfig = models.find((m) => m.id === model);
    if (modelConfig?.hidden) {
      return Response.json({ error: `模型 ${model} 暂不可用` }, { status: 400 });
    }

    if (!prompt) {
      return Response.json({ error: "prompt 为必填参数" }, { status: 400 });
    }

    // 2.2 幂等性检查
    const idempotencyPayload = `${user!.uid}:${model}:${prompt}:${aspectRatio}`;
    idempotencyKey = createHash("sha256").update(idempotencyPayload).digest("hex");

    if (await isIdempotentProcessed(idempotencyKey)) {
      const recentGen = await serverDb
        .collection("generations")
        .where({ user_id: user!.uid, model })
        .order("created_at", "desc")
        .limit(1)
        .get();
      const last = recentGen.data?.[0];
      if (last) {
        return Response.json({
          success: true,
          image_url: last.image_url,
          generation_id: last._id,
        });
      }
      return Response.json({ error: "请勿重复提交相同请求" }, { status: 429 });
    }

    // 2.5 造相每日生成量限制
    const DAILY_FREE_LIMIT = 50;
    let dailyUsageId: string | undefined;
    if (model === "z-image-turbo") {
      try {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
        const usageDoc = await serverDb
          .collection("model_daily_usage")
          .where({ date: today, model: "z-image-turbo", user_id: user!.uid })
          .limit(1)
          .get();

        if (usageDoc.data?.[0]) {
          dailyUsageId = usageDoc.data[0]._id;
          await serverDb.collection("model_daily_usage").doc(dailyUsageId!).update({
            count: serverDb.command.inc(1),
          });
          const { data: afterData } = await serverDb.collection("model_daily_usage").doc(dailyUsageId!).get();
          if ((afterData?.count ?? 0) > DAILY_FREE_LIMIT) {
            await serverDb.collection("model_daily_usage").doc(dailyUsageId!).update({
              count: serverDb.command.inc(-1),
            });
            return Response.json(
              { error: "今日免费生成次数已达上限，请明天再来吧！" },
              { status: 429 }
            );
          }
        } else {
          const addResult = await serverDb.collection("model_daily_usage").add({
            date: today,
            model: "z-image-turbo",
            user_id: user!.uid,
            count: 1,
          });
          dailyUsageId = addResult.id!;
        }
      } catch (err: any) {
        if (!err?.message?.includes("Db or Table not exist")) throw err;
      }
    }

    // 3. 安全审核
    const checkResult = await checkPrompt(prompt);
    if (!checkResult.passed) {
      await serverDb.collection("audit_logs").add({
        user_id: user!.uid,
        prompt,
        reason: checkResult.reason,
        created_at: new Date().toISOString(),
      });
      return Response.json({ error: checkResult.reason }, { status: 400 });
    }

    // 4. 额度检查与扣减
    const creditModelConfig = models.find((m) => m.id === model);
    creditCost = creditModelConfig?.creditCost || 0;

    if (creditCost > 0) {
      const deductResult = await deductCredits(user!.uid, creditCost);
      if (!deductResult.success) {
        return Response.json({ error: deductResult.error }, { status: 402 });
      }
      creditDeducted = true;
    }

    // 5. 处理参考图片 — 上传到 CloudBase，存 fileID（task runner 用 SDK 下载）
    const referenceImageFileIds: string[] = [];
    for (const file of referenceImageFiles) {
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const cloudPath = `reference-images/ref-${Date.now()}-${referenceImageFileIds.length}.png`;
        const uploadRes = await app.uploadFile({ cloudPath, fileContent: buffer });
        referenceImageFileIds.push(uploadRes.fileID);
      }
    }

    // 6. 创建 pending task（客户端拿到 task_id 后主动触发执行）
    const taskResult = await serverDb.collection("generation_tasks").add({
      user_id: user!.uid,
      prompt,
      model,
      aspect_ratio: aspectRatio,
      width,
      height,
      reference_image_file_ids: referenceImageFileIds.length > 0 ? referenceImageFileIds : null,
      idempotency_key: idempotencyKey,
      credit_cost: creditCost,
      credit_deducted: creditDeducted,
      status: "pending",
      created_at: new Date().toISOString(),
    });
    const taskId = taskResult.id!;

    // 7. 立即返回 task_id（客户端通过 POST /api/task/{id} 触发执行）
    return Response.json({
      success: true,
      task_id: taskId,
    });
  } catch (error: any) {
    // 验证/扣费阶段失败，回滚已扣减的额度
    if (creditDeducted && creditCost > 0 && user) {
      const { refundCredits } = await import("@/lib/credits");
      await refundCredits(user.uid, creditCost);
    }

    console.error("Generate API error:", error?.message);

    if (error.response?.data) {
      console.error("API response:", error.response.data);
    }

    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));

    const raw = error instanceof Error ? error.message : String(error);
    if (raw.includes("timeout") || raw.includes("超时"))
      return Response.json({ error: "生成超时，请稍后重试" }, { status: 500 });
    if (raw.includes("缺少环境变量"))
      return Response.json({ error: "服务暂时不可用，请稍后再试" }, { status: 500 });

    return Response.json({ error: "生成失败，请稍后重试" }, { status: 500 });
  }
}
