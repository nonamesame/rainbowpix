import axios from "axios";
import app from "./cloudbase/server";

export async function generateImage(
  prompt: string,
  size: string
): Promise<string> {
  const response = await axios.post(
    `${process.env.HMVI_BASE_URL}/images/generations`,
    { prompt, size },
    {
      headers: {
        Authorization: `Bearer ${process.env.HMVI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const b64 = response.data.data[0].b64_json;
  const buffer = Buffer.from(b64, "base64");

  const fileName = `hmvi-${Date.now()}.png`;
  const cloudPath = `generated-images/${fileName}`;

  await app.uploadFile({
    cloudPath,
    fileContent: buffer,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${siteUrl}/api/images/${cloudPath}`;
}
