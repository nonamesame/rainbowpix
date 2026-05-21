import axios from "axios";
import app from "./cloudbase/server";

export async function downloadAndUpload(
  tempUrl: string,
  fileName: string
): Promise<string> {
  const response = await axios.get(tempUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);

  const cloudPath = `generated-images/${fileName}`;

  const uploadRes = await app.uploadFile({
    cloudPath,
    fileContent: buffer,
  });
  const fileID = uploadRes.fileID;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${siteUrl}/api/images/${encodeURIComponent(fileID)}`;
}

export async function uploadBase64(
  base64: string,
  fileName: string,
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const cloudPath = `reference-images/${fileName}`;

  const uploadRes = await app.uploadFile({
    cloudPath,
    fileContent: buffer,
  });
  const fileID = uploadRes.fileID;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${siteUrl}/api/images/${encodeURIComponent(fileID)}`;
}
