import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { checkPrompt } from "@/lib/security";
import { downloadAndUpload } from "@/lib/upload";
import { generateImage as generateJimeng } from "@/lib/jimeng";
import { generateImage as generateReplicate } from "@/lib/replicate";
import { generateImage as generateHMVI } from "@/lib/hmvi-gpt";

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "未提供认证令牌" }, { status: 401 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "无效的认证令牌" }, { status: 401 });
    }

    // 2. 解析请求参数
    const body = await request.json();
    const { prompt, negative_prompt, model = "jimeng-4.0", width = 1024, height = 1024 } = body;

    if (!prompt) {
      return NextResponse.json({ error: "prompt 为必填参数" }, { status: 400 });
    }

    // 3. 安全审核
    const checkResult = await checkPrompt(prompt);
    if (!checkResult.passed) {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        prompt,
        reason: checkResult.reason,
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ error: checkResult.reason }, { status: 400 });
    }

    // 4. 根据模型路由调用生成函数
    let imageUrl: string;
    const negativePromptStr = negative_prompt || "";

    switch (model) {
      case "jimeng-4.0": {
        const tempUrl = await generateJimeng(prompt, negativePromptStr, width, height);
        imageUrl = await downloadAndUpload(tempUrl, `jimeng-${Date.now()}.png`);
        break;
      }
      case "sdxl": {
        const tempUrl = await generateReplicate(prompt, negativePromptStr, width, height);
        imageUrl = await downloadAndUpload(tempUrl, `sdxl-${Date.now()}.png`);
        break;
      }
      case "gpt-image-2": {
        imageUrl = await generateHMVI(prompt, `${width}x${height}`);
        break;
      }
      default:
        return NextResponse.json({ error: `不支持的模型: ${model}` }, { status: 400 });
    }

    // 5. 写入 generations 表
    const { data: generation, error: dbError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        prompt,
        model,
        image_url: imageUrl,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (dbError) {
      throw dbError;
    }

    // 6. 返回结果
    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      generation_id: generation.id,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
