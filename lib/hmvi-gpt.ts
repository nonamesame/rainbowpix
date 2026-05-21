import axios from "axios";

export async function generateImage(
  prompt: string,
  size: string,
  referenceImageBase64?: string,
): Promise<string> {
  // 有参考图时使用 /images/edits 端点，否则使用 /images/generations
  if (referenceImageBase64) {
    const formData = new FormData();
    // 将 base64 转为 Blob
    const byteCharacters = atob(referenceImageBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/png" });
    formData.append("image", blob, "reference.png");
    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-2");
    formData.append("n", "1");
    formData.append("size", size);

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

    const b64 = response.data.data[0].b64_json;
    return `data:image/png;base64,${b64}`;
  }

  // 无参考图时使用 /images/generations
  const body: Record<string, any> = { prompt, model: "gpt-image-2", n: 1, size };

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

  const b64 = response.data.data[0].b64_json;
  return `data:image/png;base64,${b64}`;
}
