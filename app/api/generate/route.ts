import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serverDb } from "@/lib/cloudbase/server";
import { checkPrompt } from "@/lib/security";
import { downloadAndUpload, uploadBase64 } from "@/lib/upload";
import { generateImage as generateJimeng } from "@/lib/jimeng";
import { generateImage as generateHMVI } from "@/lib/hmvi-gpt";
import { generateImage as generateModelScope } from "@/lib/modelscope";
import { getPixelSize, models } from "@/lib/models";
import { checkCredits, deductCredits, refundCredits } from "@/lib/credits";

function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  // 环境变量缺失
  if (raw.includes("缺少环境变量")) return "服务暂时不可用，请稍后再试";

  // 网络 / 超时
  if (raw.includes("timeout") || raw.includes("超时") || raw.includes("ETIMEDOUT"))
    return "生成超时，请稍后重试";
  if (raw.includes("ECONNREFUSED") || raw.includes("ENOTFOUND") || raw.includes("网络"))
    return "网络连接异常，请检查网络后重试";

  // 即梦 API 错误码
  const jimengMatch = raw.match(/即梦 API 错误 \[(\d+)\]/);
  if (jimengMatch) {
    const code = jimengMatch[1];
    if (code === "10001" || code === "10002") return "提示词包含违规内容，请修改后重试";
    if (code === "10013") return "即梦服务繁忙，请稍后重试";
    return `即梦生成失败（错误码 ${code}），请稍后重试`;
  }
  if (raw.includes("即梦 API 未返回图片数据")) return "即梦生成失败，请更换提示词重试";

  // ModelScope 错误
  if (raw.includes("ModelScope 生成失败")) {
    const detail = raw.replace("ModelScope 生成失败: ", "");
    return `生成失败：${detail}`;
  }
  if (raw.includes("ModelScope")) return "造相模型服务异常，请稍后重试";

  // GPT Image 错误
  if (raw.includes("GPT Image 2 未返回图片数据")) return "GPT Image 2 生成失败，请更换提示词重试";
  if (raw.includes("GPT Image 2 生成失败")) {
    return raw.replace("GPT Image 2 生成失败", "图片生成失败").replace(/^\s*[:：]\s*/, "：");
  }
  if (raw.includes("该提示词可能包含违禁词") || raw.includes("违规内容"))
    return "提示词包含违规内容，请修改后重试";

  // HTTP 状态码
  if (raw.includes("429") || raw.includes("rate limit"))
    return "请求过于频繁，请稍后再试";
  if (raw.includes("503") || raw.includes("502"))
    return "服务暂时不可用，请稍后重试";

  // 兜底：不暴露技术细节
  return "生成失败，请稍后重试";
}

export async function POST(request: NextRequest) {
  let user: { uid: string; email?: string } | undefined;
  let creditDeducted = false;
  let creditCost = 0;

  try {
    // 1. 验证用户身份（通过签名 cookie）
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

    // 2.5 造相每日生成量限制（每用户每天50次）
    const DAILY_FREE_LIMIT = 50;
    if (model === "z-image-turbo") {
      try {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD
        const usageDoc = await serverDb
          .collection("model_daily_usage")
          .where({ date: today, model: "z-image-turbo", user_id: user!.uid })
          .limit(1)
          .get();
        const currentCount = usageDoc.data?.[0]?.count || 0;
        if (currentCount >= DAILY_FREE_LIMIT) {
          return Response.json(
            { error: "今日免费生成次数已达上限，请明天再来吧！" },
            { status: 429 }
          );
        }
      } catch (err: any) {
        // 集合不存在时跳过限额检查
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

    // 4. 处理参考图片（如果有）
    const referenceImagesBase64: string[] = [];
    const referenceImageUrls: string[] = [];
    for (const file of referenceImageFiles) {
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        referenceImagesBase64.push(base64);
        const url = await uploadBase64(base64, `ref-${Date.now()}-${referenceImageUrls.length}.png`);
        referenceImageUrls.push(url);
      }
    }

    // 4.5 额度检查与扣减（仅 gpt-image-2）
    const creditModelConfig = models.find((m) => m.id === model);
    creditCost = creditModelConfig?.creditCost || 0;

    if (creditCost > 0) {
      // 先快速检查余额，不够直接返回
      const { hasEnough, balance } = await checkCredits(user!.uid, creditCost);
      if (!hasEnough) {
        return Response.json({ error: "额度不足" }, { status: 402 });
      }
      // 余额足够再扣减
      const deductResult = await deductCredits(user!.uid, creditCost);
      if (!deductResult.success) {
        return Response.json({ error: deductResult.error }, { status: 402 });
      }
      creditDeducted = true;
    }

    // 5. 根据模型路由调用生成函数
    let imageUrl: string;

    switch (model) {
      case "jimeng-3.0": {
        imageUrl = await generateJimeng(prompt, "", width, height, undefined, "jimeng_t2i_v30");
        break;
      }
      case "jimeng-4.0": {
        imageUrl = await generateJimeng(prompt, "", width, height, referenceImagesBase64[0], undefined, "v4");
        break;
      }
      case "gpt-image-2": {
        console.log("[generate] gpt-image-2 prompt:", prompt, "size:", `${width}x${height}`, "refCount:", referenceImagesBase64.length);
        imageUrl = await generateHMVI(prompt, `${width}x${height}`, referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined);
        break;
      }
      case "z-image-turbo": {
        console.log("[generate] z-image-turbo prompt:", prompt, "size:", `${width}x${height}`);
        imageUrl = await generateModelScope(prompt, width, height);
        console.log("[generate] z-image-turbo result:", imageUrl?.substring(0, 100));
        break;
      }
      default:
        return Response.json({ error: `不支持的模型: ${model}` }, { status: 400 });
    }

    // 5. 先上传到 CloudBase 存储，拿到永久 URL（避免返回巨大 base64 导致超时）
    let permanentUrl: string;
    if (imageUrl.startsWith("data:")) {
      const base64 = imageUrl.split(",")[1];
      permanentUrl = await uploadBase64(base64, `${model}-${Date.now()}.png`);
    } else {
      permanentUrl = await downloadAndUpload(imageUrl, `${model}-${Date.now()}.png`);
    }

    // 6. 写入 generations 集合
    const addResult = await serverDb.collection("generations").add({
      user_id: user!.uid,
      prompt,
      model,
      image_url: permanentUrl,
      reference_image_url: referenceImageUrls.length > 0 ? JSON.stringify(referenceImageUrls) : null,
      created_at: new Date().toISOString(),
      published: false,
      watermark_enabled: false,
      likes_count: 0,
      source: "ai",
      width,
      height,
    });
    const id = addResult.id!;

    // 6.5 造相成功后更新每日用量（按用户统计）
    if (model === "z-image-turbo") {
      try {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
        const usageDoc = await serverDb
          .collection("model_daily_usage")
          .where({ date: today, model: "z-image-turbo", user_id: user!.uid })
          .limit(1)
          .get();
        if (usageDoc.data?.[0]) {
          await serverDb.collection("model_daily_usage").doc(usageDoc.data[0]._id).update({
            count: serverDb.command.inc(1),
          });
        } else {
          await serverDb.collection("model_daily_usage").add({
            date: today,
            model: "z-image-turbo",
            user_id: user!.uid,
            count: 1,
          });
        }
      } catch (err: any) {
        // 集合不存在时跳过用量记录
        if (!err?.message?.includes("Db or Table not exist")) console.error("model_daily_usage update failed:", err);
      }
    }

    // 7. 返回永久 URL（小字符串，不会超时）
    return Response.json({
      success: true,
      image_url: permanentUrl,
      generation_id: id,
    });
  } catch (error: any) {
    // 生成失败时回滚已扣减的额度
    if (creditDeducted && creditCost > 0 && user) {
      await refundCredits(user.uid, creditCost);
    }

    console.error("Generate API error:", error?.message);

    if (error.response?.data) {
      console.error("API response:", error.response.data);
    }

    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    const message = friendlyError(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
