import { decodeUserCookie } from "@/lib/utils";
import { NextRequest, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serverDb } from "@/lib/cloudbase/server";
import { checkPrompt } from "@/lib/security";
import { downloadAndUpload, uploadBase64 } from "@/lib/upload";
import { generateImage as generateJimeng } from "@/lib/jimeng";
import { generateImage as generateHMVI } from "@/lib/hmvi-gpt";
import { generateImage as generateModelScope } from "@/lib/modelscope";
import { getPixelSize } from "@/lib/models";

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
  try {
    // 1. 验证用户身份（通过 cookie）
    const userPayload = request.cookies.get("tcb_user")?.value;
    if (!userPayload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    let user: { uid: string; email?: string };
    try {
      user = decodeUserCookie(userPayload);
    } catch {
      return Response.json({ error: "登录信息无效" }, { status: 401 });
    }

    // 2. 解析 FormData
    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const model = (formData.get("model") as string) || "jimeng-4.0";
    const aspectRatio = (formData.get("aspect_ratio") as string) || "1:1";
    const { w: width, h: height } = getPixelSize(aspectRatio, model);
    const referenceImageFiles = formData.getAll("reference_image") as File[];

    if (!prompt) {
      return Response.json({ error: "prompt 为必填参数" }, { status: 400 });
    }

    // 2.5 造相每日生成量限制
    if (model === "z-image-turbo") {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD
      const usageDoc = await serverDb
        .collection("model_daily_usage")
        .where({ date: today, model: "z-image-turbo" })
        .limit(1)
        .get();
      const currentCount = usageDoc.data?.[0]?.count || 0;
      if (currentCount >= 2000) {
        return Response.json(
          { error: "今日该模型已达上限，请明天再来吧！" },
          { status: 429 }
        );
      }
    }

    // 3. 安全审核
    const checkResult = await checkPrompt(prompt);
    if (!checkResult.passed) {
      await serverDb.collection("audit_logs").add({
        user_id: user.uid,
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
        console.log("[generate] z-image-turbo prompt:", prompt);
        imageUrl = await generateModelScope(prompt, width, height);
        break;
      }
      default:
        return Response.json({ error: `不支持的模型: ${model}` }, { status: 400 });
    }

    // 5. 写入 generations 集合（先用原始 URL）
    const addResult = await serverDb.collection("generations").add({
      user_id: user.uid,
      prompt,
      model,
      image_url: imageUrl,
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

    // 5.5 造相成功后更新每日用量
    if (model === "z-image-turbo") {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
      const usageDoc = await serverDb
        .collection("model_daily_usage")
        .where({ date: today, model: "z-image-turbo" })
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
          count: 1,
        });
      }
    }

    // 6. 响应发送后，异步上传到 CloudBase 并更新数据库
    after(async () => {
      try {
        let permanentUrl: string;
        if (imageUrl.startsWith("data:")) {
          const base64 = imageUrl.split(",")[1];
          permanentUrl = await uploadBase64(base64, `${model}-${Date.now()}.png`);
        } else {
          permanentUrl = await downloadAndUpload(imageUrl, `${model}-${Date.now()}.png`);
        }
        await serverDb.collection("generations").doc(id).update({
          image_url: permanentUrl,
        });
      } catch (err) {
        console.error("[generate] async upload failed:", err);
      }
    });

    // 7. 立即返回原始 URL
    return Response.json({
      success: true,
      image_url: imageUrl,
      generation_id: id,
    });
  } catch (error: any) {
    console.error("Generate API error:", error?.message);

    if (error.response?.data) {
      console.error("API response:", error.response.data);
    }

    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    const message = friendlyError(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
