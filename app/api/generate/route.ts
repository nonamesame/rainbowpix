import { NextRequest, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serverDb } from "@/lib/cloudbase/server";
import { checkPrompt } from "@/lib/security";
import { downloadAndUpload, uploadBase64 } from "@/lib/upload";
import { generateImage as generateJimeng } from "@/lib/jimeng";
import { generateImage as generateHMVI } from "@/lib/hmvi-gpt";

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份（通过 cookie）
    const userPayload = request.cookies.get("tcb_user")?.value;
    if (!userPayload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    let user: { uid: string; email?: string };
    try {
      user = JSON.parse(atob(userPayload));
    } catch {
      return Response.json({ error: "登录信息无效" }, { status: 401 });
    }

    // 2. 解析 FormData
    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const negative_prompt = formData.get("negative_prompt") as string || "";
    const model = (formData.get("model") as string) || "jimeng-4.0";
    const width = Number(formData.get("width")) || 1024;
    const height = Number(formData.get("height")) || 1024;
    const referenceImageFile = formData.get("reference_image") as File | null;

    if (!prompt) {
      return Response.json({ error: "prompt 为必填参数" }, { status: 400 });
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
    let referenceImageBase64: string | undefined;
    let referenceImageUrl: string | undefined;
    if (referenceImageFile && referenceImageFile.size > 0) {
      const buffer = Buffer.from(await referenceImageFile.arrayBuffer());
      referenceImageBase64 = buffer.toString("base64");
      // 异步上传参考图到存储
      referenceImageUrl = await uploadBase64(
        referenceImageBase64,
        `ref-${Date.now()}.png`,
      );
    }

    // 5. 根据模型路由调用生成函数
    let imageUrl: string;

    switch (model) {
      case "jimeng-3.0": {
        imageUrl = await generateJimeng(prompt, negative_prompt, width, height, undefined, "jimeng_t2i_v30");
        break;
      }
      case "jimeng-4.0": {
        imageUrl = await generateJimeng(prompt, negative_prompt, width, height, referenceImageBase64);
        break;
      }
      case "gpt-image-2": {
        imageUrl = await generateHMVI(prompt, `${width}x${height}`, referenceImageBase64);
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
      reference_image_url: referenceImageUrl || null,
      created_at: new Date().toISOString(),
    });
    const id = addResult.id!;

    // 6. 响应发送后，异步上传到 CloudBase 并更新数据库
    if (!imageUrl.startsWith("data:")) {
      after(async () => {
        try {
          const permanentUrl = await downloadAndUpload(
            imageUrl,
            `${model}-${Date.now()}.png`
          );
          await serverDb.collection("generations").doc(id).update({
            image_url: permanentUrl,
          });
        } catch (err) {
          console.error("[generate] async upload failed:", err);
        }
      });
    }

    // 7. 立即返回原始 URL
    return Response.json({
      success: true,
      image_url: imageUrl,
      generation_id: id,
    });
  } catch (error: any) {
    console.error("Generate API error:", error);

    // 如果是即梦API返回的错误，提取详细信息
    if (error.response?.data) {
      console.error("即梦 API response:", error.response.data);
    }

    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return Response.json({ error: message, details: error.response?.data || null }, { status: 500 });
  }
}
