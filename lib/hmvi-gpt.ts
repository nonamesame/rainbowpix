import axios from "axios";

function base64ToBlob(base64: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: "image/png" });
}

// 超时配置：GPT Image 2 edits 端点可能需要很长时间，设置 180s
const IS_SERVERLESS = process.env.VERCEL || process.env.CLOUDFLARE_WORKERS || process.env.TCB || process.env.NODE_ENV === 'production';
const REQUEST_TIMEOUT = IS_SERVERLESS ? 180000 : 60000;

export async function generateImage(
  prompt: string,
  size: string,
  referenceImagesBase64?: string[],
): Promise<string> {
  const startTime = Date.now();
  const hasReference = referenceImagesBase64 && referenceImagesBase64.length > 0;
  const endpoint = hasReference ? "/images/edits" : "/images/generations";
  const fullUrl = `${process.env.HMVI_BASE_URL}${endpoint}`;

  console.log("[HMVI] ========== 开始生成 ==========");
  console.log("[HMVI] 环境:", process.env.VERCEL ? "Vercel" : process.env.CLOUDFLARE_WORKERS ? "Cloudflare" : process.env.TCB ? "CloudBase" : process.env.EDGEONE ? "EdgeOne" : "本地");
  console.log("[HMVI] Base URL:", process.env.HMVI_BASE_URL);
  console.log("[HMVI] API Key 存在:", !!process.env.HMVI_API_KEY);
  console.log("[HMVI] 请求端点:", fullUrl);
  console.log("[HMVI] Prompt:", prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""));
  console.log("[HMVI] Size:", size);
  console.log("[HMVI] 参考图数量:", hasReference ? referenceImagesBase64!.length : 0);
  console.log("[HMVI] 超时设置:", REQUEST_TIMEOUT, "ms");

  // 有参考图时使用 /images/edits 端点，否则使用 /images/generations
  if (hasReference) {
    console.log("[HMVI] 使用 /images/edits 端点（有参考图）");

    const formData = new FormData();
    for (let i = 0; i < referenceImagesBase64!.length; i++) {
      const blob = base64ToBlob(referenceImagesBase64![i]);
      formData.append("image", blob, `reference-${i + 1}.png`);
    }
    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-2-1k");
    formData.append("n", "1");
    formData.append("size", size);
    formData.append("response_format", "b64_json");

    console.log("[HMVI] 正在发送请求到 edits 端点...");
    const requestStart = Date.now();

    try {
      const response = await axios.post(fullUrl, formData, {
        headers: {
          Authorization: `Bearer ${process.env.HMVI_API_KEY}`,
          "Content-Type": "multipart/form-data",
        },
        timeout: REQUEST_TIMEOUT,
      });

      const requestTime = Date.now() - requestStart;
      console.log("[HMVI] Edits 请求完成，耗时:", requestTime, "ms");
      console.log("[HMVI] 响应状态码:", response.status);
      console.log("[HMVI] 响应数据结构:", Object.keys(response.data || {}).join(", "));

      if (response.data.error) {
        console.error("[HMVI] API 返回错误:", response.data.error);
        throw new Error(response.data.error.message || "GPT Image 2 生成失败");
      }
      if (!response.data.data?.length) {
        console.error("[HMVI] 未返回图片数据，完整响应:", JSON.stringify(response.data).substring(0, 500));
        throw new Error("该提示词可能包含违禁词，或者违反 GPT Image 2 的相关政策（如第三方品牌相似保护）");
      }

      const b64 = response.data.data[0].b64_json;
      if (!b64) throw new Error("GPT Image 2 未返回图片数据");

      const totalTime = Date.now() - startTime;
      console.log("[HMVI] ========== 生成完成 ==========");
      console.log("[HMVI] 总耗时:", totalTime, "ms");
      return `data:image/png;base64,${b64}`;
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error("[HMVI] ========== 请求失败 ==========");
      console.error("[HMVI] 总耗时:", totalTime, "ms");
      console.error("[HMVI] 错误类型:", error.constructor.name);
      console.error("[HMVI] 错误消息:", error.message);

      if (error.code) {
        console.error("[HMVI] 错误代码:", error.code);
      }
      if (error.response) {
        console.error("[HMVI] 响应状态码:", error.response.status);
        console.error("[HMVI] 响应数据:", JSON.stringify(error.response.data).substring(0, 500));
      } else if (error.request) {
        console.error("[HMVI] 请求已发送但无响应");
        console.error("[HMVI] 请求超时:", error.message.includes("timeout"));
      }

      throw error;
    }
  }

  // 无参考图时使用 /images/generations
  console.log("[HMVI] 使用 /images/generations 端点（无参考图）");
  const body: Record<string, any> = { prompt, model: "gpt-image-2-1k", n: 1, size, response_format: "b64_json" };

  console.log("[HMVI] 正在发送请求到 generations 端点...");
  const requestStart = Date.now();

  try {
    const response = await axios.post(fullUrl, body, {
      headers: {
        Authorization: `Bearer ${process.env.HMVI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: REQUEST_TIMEOUT,
    });

    const requestTime = Date.now() - requestStart;
    console.log("[HMVI] Generations 请求完成，耗时:", requestTime, "ms");
    console.log("[HMVI] 响应状态码:", response.status);
    console.log("[HMVI] 响应数据结构:", Object.keys(response.data || {}).join(", "));

    if (response.data.error) {
      console.error("[HMVI] API 返回错误:", response.data.error);
      throw new Error(response.data.error.message || "GPT Image 2 生成失败");
    }
    if (!response.data.data?.length) {
      console.error("[HMVI] 未返回图片数据，完整响应:", JSON.stringify(response.data).substring(0, 500));
      throw new Error("提示词可能包含违规内容，请修改后重试");
    }

    const b64 = response.data.data[0].b64_json;
    if (!b64) throw new Error("GPT Image 2 未返回图片数据");

    const totalTime = Date.now() - startTime;
    console.log("[HMVI] ========== 生成完成 ==========");
    console.log("[HMVI] 总耗时:", totalTime, "ms");
    return `data:image/png;base64,${b64}`;
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error("[HMVI] ========== 请求失败 ==========");
    console.error("[HMVI] 总耗时:", totalTime, "ms");
    console.error("[HMVI] 错误类型:", error.constructor.name);
    console.error("[HMVI] 错误消息:", error.message);

    if (error.code) {
      console.error("[HMVI] 错误代码:", error.code);
    }
    if (error.response) {
      console.error("[HMVI] 响应状态码:", error.response.status);
      console.error("[HMVI] 响应数据:", JSON.stringify(error.response.data).substring(0, 500));
    } else if (error.request) {
      console.error("[HMVI] 请求已发送但无响应");
      console.error("[HMVI] 请求超时:", error.message.includes("timeout"));
    }

    throw error;
  }
}
