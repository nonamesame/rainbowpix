import axios from "axios";

const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY;
const BASE_URL = "https://api-inference.modelscope.cn/";

const commonHeaders = {
  Authorization: `Bearer ${MODELSCOPE_API_KEY}`,
  "Content-Type": "application/json",
};

export async function generateImage(
  prompt: string,
  width: number,
  height: number
): Promise<string> {
  if (!MODELSCOPE_API_KEY) {
    throw new Error("缺少环境变量 MODELSCOPE_API_KEY");
  }

  // 1. 提交异步任务
  const submitResp = await axios.post(
    `${BASE_URL}v1/images/generations`,
    {
      model: "Tongyi-MAI/Z-Image-Turbo",
      prompt,
      size: `${width}x${height}`,
    },
    {
      headers: { ...commonHeaders, "X-ModelScope-Async-Mode": "true" },
      timeout: 30_000,
    }
  );

  console.log("[modelscope] submit response:", JSON.stringify(submitResp.data));
  const taskId = submitResp.data.task_id;
  if (!taskId) {
    console.error("[modelscope] no task_id in response:", JSON.stringify(submitResp.data));
    throw new Error("ModelScope API 未返回 task_id");
  }

  console.log("[modelscope] task submitted:", taskId);

  // 2. 轮询任务状态（最多等5分钟）
  const maxAttempts = 150; // 150 * 2s = 5min
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const result = await axios.get(`${BASE_URL}v1/tasks/${taskId}`, {
      headers: {
        ...commonHeaders,
        "X-ModelScope-Task-Type": "image_generation",
      },
      timeout: 10_000,
    });

    console.log(`[modelscope] poll #${i + 1} response:`, JSON.stringify(result.data));
    const status = result.data.task_status;
    console.log(`[modelscope] task ${taskId} status: ${status}`);

    if (status === "SUCCEED") {
      const outputImages = result.data.output_images;
      if (!outputImages?.length) {
        throw new Error("ModelScope API 未返回图片数据");
      }
      // 返回图片URL，后续由route.ts处理下载上传
      return outputImages[0];
    }

    if (status === "FAILED") {
      throw new Error(`ModelScope 生成失败: ${result.data.message || "未知错误"}`);
    }
  }

  throw new Error("ModelScope 生成超时");
}
