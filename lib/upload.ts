import axios from "axios";
import app from "./cloudbase/server";

export async function downloadAndUpload(
  tempUrl: string,
  fileName: string
): Promise<string> {
  const response = await axios.get(tempUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);

  const cloudPath = `generated-images/${fileName}`;

  await app.uploadFile({
    cloudPath,
    fileContent: buffer,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${siteUrl}/api/images/${cloudPath}`;
}
