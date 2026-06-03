import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import app from "@/lib/cloudbase/server";
import axios from "axios";
import sharp from "sharp";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: generationId } = await params;

  // Get the generation
  const { data } = await serverDb
    .collection("generations")
    .where({ _id: generationId, published: true })
    .field(["image_url", "user_id", "watermark_enabled", "username"])
    .get();

  if (!data || data.length === 0) {
    return Response.json({ error: "未找到" }, { status: 404 });
  }

  const generation = data[0];

  // Check if requester is the owner
  let isOwner = false;
  const authUser = getUserFromRequest(request);
  if (authUser) {
    isOwner = authUser.uid === generation.user_id;
  }

  // Owner always gets the original
  if (isOwner || !generation.watermark_enabled) {
    // Redirect to the regular proxy
    const imageUrl = generation.image_url;
    // Extract the CloudBase file path from the URL
    const tcbMatch = imageUrl.match(/https?:\/\/[^/]+\.tcloudbaseapp\.com\/(.+)$/);
    if (tcbMatch) {
      return Response.redirect(`/api/images/${tcbMatch[1]}`);
    }
    return Response.redirect(imageUrl);
  }

  // Apply watermark for non-owners
  try {
    // Get temp URL from CloudBase
    const urlRes = await app.getTempFileURL({ fileList: [generation.image_url] });
    const fileList = (urlRes as any).fileList || [];
    const item = fileList[0];

    if (!item || item.code !== "SUCCESS" || !item.download_url) {
      return Response.json({ error: "图片获取失败" }, { status: 500 });
    }

    // Download original image
    const imgResponse = await axios.get(item.download_url, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(imgResponse.data);

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    // Create watermark text
    const watermarkText = `RP·${generation.username || "用户"}`;
    const fontSize = Math.max(16, Math.floor(width / 40));

    const svgText = `
      <svg width="${width}" height="${height}">
        <style>
          text {
            font-family: sans-serif;
            font-size: ${fontSize}px;
            fill: rgba(255,255,255,0.4);
          }
        </style>
        <text x="${width - fontSize}" y="${height - fontSize}" text-anchor="end">${watermarkText}</text>
      </svg>
    `;

    const watermarked = await sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgText), gravity: "southeast" }])
      .png()
      .toBuffer();

    return new Response(new Uint8Array(watermarked), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[watermark] error:", error);
    return Response.json({ error: "水印处理失败" }, { status: 500 });
  }
}
