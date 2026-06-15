import app, { serverDb } from "@/lib/cloudbase/server";
import { generateImage as generateJimeng } from "@/lib/jimeng";
import { generateImage as generateHMVI } from "@/lib/hmvi-gpt";
import { generateImage as generateModelScope } from "@/lib/modelscope";
import { downloadAndUpload, uploadBase64 } from "@/lib/upload";
import { refundCredits } from "@/lib/credits";
import * as Sentry from "@sentry/nextjs";

interface RunTaskParams {
  taskId: string;
  userId: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
  idempotencyKey: string;
  creditCost: number;
  creditDeducted: boolean;
  referenceImageFileIds?: string[]; // CloudBase fileIDs，非 URL
}

export async function runTask(params: RunTaskParams): Promise<void> {
  const {
    taskId,
    userId,
    prompt,
    model,
    width,
    height,
    idempotencyKey,
    creditCost,
    creditDeducted,
    referenceImageFileIds,
  } = params;

  // CAS: 仅当 status=pending 时原子更新为 running，防止重复执行
  await serverDb
    .collection("generation_tasks")
    .doc(taskId)
    .update({ status: "running" });

  // 重新查询验证是否真的更新成功
  const { data: taskDoc } = await serverDb
    .collection("generation_tasks")
    .doc(taskId)
    .get();

  if (!taskDoc || taskDoc.status !== "running") {
    return; // 已被其他实例处理
  }

  try {
    // 1. 下载参考图片并转为 base64（通过 CloudBase SDK 获取临时 URL）
    const referenceImagesBase64: string[] = [];
    if (referenceImageFileIds?.length) {
      try {
        const urlRes = await app.getTempFileURL({
          fileList: referenceImageFileIds,
        });
        const fileInfos = urlRes.fileList || [];
        for (const info of fileInfos) {
          if (info.tempFileURL) {
            const resp = await fetch(info.tempFileURL);
            const buffer = Buffer.from(await resp.arrayBuffer());
            referenceImagesBase64.push(buffer.toString("base64"));
          }
        }
      } catch (e) {
        console.error("[task-runner] Failed to download reference images:", e);
      }
    }

    // 2. 调用 AI 生成
    let imageUrl: string;

    switch (model) {
      case "jimeng-3.0":
        imageUrl = await generateJimeng(prompt, "", width, height, undefined, "jimeng_t2i_v30");
        break;
      case "jimeng-4.0":
        imageUrl = await generateJimeng(prompt, "", width, height, referenceImagesBase64[0], undefined, "v4");
        break;
      case "gpt-image-2-1k":
        imageUrl = await generateHMVI(
          prompt,
          `${width}x${height}`,
          referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined
        );
        break;
      case "z-image-turbo":
        imageUrl = await generateModelScope(prompt, width, height);
        break;
      default:
        throw new Error(`不支持的模型: ${model}`);
    }

    // 3. 上传到 CloudBase 存储
    let permanentUrl: string;
    if (imageUrl.startsWith("data:")) {
      const base64 = imageUrl.split(",")[1];
      permanentUrl = await uploadBase64(base64, `${model}-${Date.now()}.png`);
    } else {
      permanentUrl = await downloadAndUpload(imageUrl, `${model}-${Date.now()}.png`);
    }

    // 4. 写入 generations 集合
    const addResult = await serverDb.collection("generations").add({
      user_id: userId,
      prompt,
      model,
      image_url: permanentUrl,
      reference_image_url: referenceImageFileIds?.length ? JSON.stringify(referenceImageFileIds) : null,
      created_at: new Date().toISOString(),
      published: false,
      watermark_enabled: false,
      likes_count: 0,
      source: "ai",
      width,
      height,
    });

    // 5. 更新 task 状态为 completed
    await serverDb.collection("generation_tasks").doc(taskId).update({
      status: "completed",
      image_url: permanentUrl,
      generation_id: addResult.id,
      completed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`[task-runner] Task ${taskId} failed:`, error?.message);

    // 生成失败，回滚已扣减的额度
    if (creditDeducted && creditCost > 0) {
      await refundCredits(userId, creditCost);
    }

    // 更新 task 状态为 failed
    const friendlyMsg = getFriendlyError(error);
    await serverDb.collection("generation_tasks").doc(taskId).update({
      status: "failed",
      error: friendlyMsg,
      failed_at: new Date().toISOString(),
    });

    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  }
}

function getFriendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("缺少环境变量")) return "服务暂时不可用，请稍后再试";
  if (raw.includes("timeout") || raw.includes("超时") || raw.includes("ETIMEDOUT"))
    return "生成超时，请稍后重试";
  if (raw.includes("ECONNREFUSED") || raw.includes("ENOTFOUND"))
    return "网络连接异常，请检查网络后重试";

  const jimengMatch = raw.match(/即梦 API 错误 \[(\d+)\]/);
  if (jimengMatch) {
    const code = jimengMatch[1];
    if (code === "10001" || code === "10002") return "提示词包含违规内容，请修改后重试";
    if (code === "10013") return "即梦服务繁忙，请稍后重试";
    return `即梦生成失败（错误码 ${code}），请稍后重试`;
  }

  if (raw.includes("ModelScope")) return "造相模型服务异常，请稍后重试";
  if (raw.includes("GPT Image 2")) return "图片生成失败，请稍后重试";

  return "生成失败，请稍后重试";
}
