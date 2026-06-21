import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serverDb } from "@/lib/cloudbase/server";
import { checkPrompt } from "@/lib/security";
import { uploadBase64 } from "@/lib/upload";
import { getPixelSize, models } from "@/lib/models";
import { deductCredits, isIdempotentProcessed, recordIdempotentKey } from "@/lib/credits";
import { createHash } from "crypto";
import app from "@/lib/cloudbase/server";

function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("缺少环境变量")) return "服务暂时不可用，请稍后再试";
  if (raw.includes("timeout") || raw.includes("超时") || raw.includes("ETIMEDOUT"))
    return "生成超时，请稍后重试";
  if (raw.includes("ECONNREFUSED") || raw.includes("ENOTFOUND") || raw.includes("网络"))
    return "网络连接异常，请检查网络后重试";

  const jimengMatch = raw.match(/即梦 API 错误 \[(\d+)\]/);
  if (jimengMatch) {
    const code = jimengMatch[1];
    if (code === "10001" || code === "10002") return "提示词包含违规内容，请修改后重试";
    if (code === "10013") return "即梦服务繁忙，请稍后重试";
    return `即梦生成失败（错误码 ${code}），请稍后重试`;
  }
  if (raw.includes("即梦 API 未返回图片数据")) return "即梦生成失败，请更换提示词重试";

  if (raw.includes("ModelScope 生成失败")) {
    const detail = raw.replace("ModelScope 生成失败: ", "");
    return `生成失败：${detail}`;
  }
  if (raw.includes("ModelScope")) return "造相模型服务异常，请稍后重试";

  if (raw.includes("GPT Image 2 未返回图片数据")) return "GPT Image 2 生成失败，请更换提示词重试";
  if (raw.includes("GPT Image 2 生成失败")) {
    return raw.replace("GPT Image 2 生成失败", "图片生成失败").replace(/^\s*[:：]\s*/, "：");
  }
  if (raw.includes("该提示词可能包含违禁词") || raw.includes("违规内容"))
    return "提示词包含违规内容，请修改后重试";

  if (raw.includes("429") || raw.includes("rate limit"))
    return "请求过于频繁，请稍后再试";
  if (raw.includes("503") || raw.includes("502"))
    return "服务暂时不可用，请稍后重试";

  return "生成失败，请稍后重试";
}

export async function POST(request: NextRequest) {
  let user: { uid: string; email?: string } | undefined;
  let creditDeducted = false;
  let creditCost = 0;

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
    const idempotencyKey = createHash("sha256").update(idempotencyPayload).digest("hex");

    console.log(`[generate] model=${model} prompt="${prompt.slice(0, 30)}..." size=${width}x${height}`);
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
    if (model === "z-image-turbo") {
      try {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
        const usageDoc = await serverDb
          .collection("model_daily_usage")
          .where({ date: today, model: "z-image-turbo", user_id: user!.uid })
          .limit(1)
          .get();

        if (usageDoc.data?.[0]) {
          const dailyUsageId = usageDoc.data[0]._id;
          await serverDb.collection("model_daily_usage").doc(dailyUsageId).update({
            count: serverDb.command.inc(1),
          });
          const { data: afterData } = await serverDb.collection("model_daily_usage").doc(dailyUsageId).get();
          if ((afterData?.count ?? 0) > DAILY_FREE_LIMIT) {
            await serverDb.collection("model_daily_usage").doc(dailyUsageId).update({
              count: serverDb.command.inc(-1),
            });
            return Response.json(
              { error: "今日免费生成次数已达上限，请明天再来吧！" },
              { status: 429 }
            );
          }
        } else {
          await serverDb.collection("model_daily_usage").add({
            date: today,
            model: "z-image-turbo",
            user_id: user!.uid,
            count: 1,
          });
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

    // 5. 处理参考图片 — 转 base64 传给云函数（云函数需要 base64，不是 URL）
    const referenceImagesBase64: string[] = [];
    for (const file of referenceImageFiles) {
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        referenceImagesBase64.push(buffer.toString("base64"));
      }
    }

    // ============================================================
    // 6. 调用云函数同步生图（等待结果直接返回）
    // ============================================================

    // 6.1 记录幂等键
    await recordIdempotentKey(idempotencyKey);

    // 6.2 调用云函数 — 同步等待结果
    const cloudFunctionPayload = {
      task_id: "sync-" + Date.now().toString(36),
      user_id: user!.uid,
      prompt,
      model,
      aspect_ratio: aspectRatio,
      reference_image_urls: referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined,
    };

    console.log(`[generate] calling cloud function — model=${model}`);

    let cfResult: any;
    let timedOut = false;
    try {
      cfResult = await app.callFunction({
        name: "generateImage",
        data: cloudFunctionPayload,
        timeout: 300000,
      });
    } catch (cfErr: any) {
      const isTimeout = /timeout|ETIMEDOUT/i.test(cfErr?.message);
      if (isTimeout) {
        console.log(`[generate] callFunction timeout — cloud function may still be running`);
        timedOut = true;
      } else {
        throw cfErr;
      }
    }

    // 6.3 处理云函数结果
    if (!timedOut) {
      const cfData = cfResult?.result;
      if (!cfData?.success) {
        // 云函数内部失败，退还额度
        if (creditDeducted && creditCost > 0 && user) {
          const { data } = await serverDb.collection("user_credits")
            .where({ user_id: user!.uid }).limit(1).get();
          const doc = data?.[0];
          if (doc) {
            await serverDb.collection("user_credits").doc(doc._id).update({
              balance: serverDb.command.inc(creditCost),
              total_used: serverDb.command.inc(-creditCost),
              updated_at: new Date().toISOString(),
            });
          }
        }
        const msg = cfData?.error || "生成失败，请稍后重试";
        return Response.json({ error: msg }, { status: 500 });
      }

      console.log(`[generate] done — image=${cfData.image_url}`);
      return Response.json({
        success: true,
        image_url: cfData.image_url,
        generation_id: cfData.generation_id,
      });
    }

    // SDK 超时 — 等几秒后查数据库拿结果（云函数可能已经写入了）
    console.log(`[generate] waiting for cloud function to finish...`);
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 10000)); // 每 10 秒查一次，最多 60 秒
      try {
        const { data: gens } = await serverDb
          .collection("generations")
          .where({ user_id: user!.uid })
          .order("created_at", "desc")
          .limit(1)
          .get();
        const latest = gens?.[0];
        if (latest) {
          const genTime = new Date(latest.created_at).getTime();
          const createTime = Date.now() - 120_000; // 2 分钟内创建的
          if (genTime >= createTime) {
            console.log(`[generate] found result after timeout — ${latest.image_url}`);
            return Response.json({
              success: true,
              image_url: latest.image_url,
              generation_id: latest._id,
            });
          }
        }
      } catch {}
    }

    // 60 秒后还没查到，返回 generating 状态让前端提示用户
    console.log(`[generate] cloud function still running after 60s retry`);
    return Response.json({
      success: true,
      status: "generating",
      message: "图片生成较慢，请稍后到画廊查看结果",
    });

  } catch (error: any) {
    // 生成失败时回滚已扣减的额度
    if (creditDeducted && creditCost > 0 && user) {
      const { data } = await serverDb.collection("user_credits")
        .where({ user_id: user!.uid }).limit(1).get();
      const doc = data?.[0];
      if (doc) {
        await serverDb.collection("user_credits").doc(doc._id).update({
          balance: serverDb.command.inc(creditCost),
          total_used: serverDb.command.inc(-creditCost),
          updated_at: new Date().toISOString(),
        });
      }
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
