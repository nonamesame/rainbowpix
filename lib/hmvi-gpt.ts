import axios from "axios";

function base64ToBlob(base64: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: "image/png" });
}

export async function generateImage(
  prompt: string,
  size: string,
  referenceImagesBase64?: string[],
): Promise<string> {
  // 有参考图时使用 /images/edits 端点，否则使用 /images/generations
  if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
    const formData = new FormData();
    for (let i = 0; i < referenceImagesBase64.length; i++) {
      const blob = base64ToBlob(referenceImagesBase64[i]);
      formData.append("image", blob, `reference-${i + 1}.png`);
    }
    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-2");
    formData.append("n", "1");
    formData.append("size", size);
    formData.append("response_format", "b64_json");

    const response = await axios.post(
      `${process.env.HMVI_BASE_URL}/images/edits`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.HMVI_API_KEY}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    console.log("HMVI edits response:", JSON.stringify(response.data, null, 2));

    if (response.data.error) {
      throw new Error(response.data.error.message || "GPT Image 2 生成失败");
    }
    if (!response.data.data?.length) {
      throw new Error("该提示词可能包含违禁词，或者违反 GPT Image 2 的相关政策（如第三方品牌相似保护）");
    }

    const b64 = response.data.data[0].b64_json;
    if (!b64) throw new Error("GPT Image 2 未返回图片数据");
    return `data:image/png;base64,${b64}`;
  }

  // 无参考图时使用 /images/generations
  const body: Record<string, any> = { prompt, model: "gpt-image-2", n: 1, size, response_format: "b64_json" };

  const response = await axios.post(
    `${process.env.HMVI_BASE_URL}/images/generations`,
    body,
    {
      headers: {
        Authorization: `Bearer ${process.env.HMVI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  console.log("HMVI generations response:", JSON.stringify(response.data, null, 2));

  if (response.data.error) {
    throw new Error(response.data.error.message || "GPT Image 2 生成失败");
  }
  if (!response.data.data?.length) {
    throw new Error("提示词可能包含违规内容，请修改后重试");
  }

  const b64 = response.data.data[0].b64_json;
  if (!b64) throw new Error("GPT Image 2 未返回图片数据");
  return `data:image/png;base64,${b64}`;
}
