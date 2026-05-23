import { NextRequest } from "next/server";
import app from "@/lib/cloudbase/server";
import axios from "axios";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const fileID = decodeURIComponent(segments.join("/"));

  console.log("[image-proxy] fileID:", fileID);

  if (!fileID) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    // Get a temporary download URL from CloudBase
    const urlRes = await app.getTempFileURL({ fileList: [fileID] });
    const fileList = (urlRes as any).fileList || [];
    const item = fileList[0];

    if (!item || item.code !== "SUCCESS" || !item.download_url) {
      console.error("[image-proxy] getTempFileURL failed:", JSON.stringify(item));
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    console.log("[image-proxy] temp URL obtained, downloading...");

    // Download image content via temp URL using axios
    const imgResponse = await axios.get(item.download_url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imgResponse.data);

    const ext = fileID.split(".").pop()?.toLowerCase() || "png";
    const contentType =
      { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[ext] || "image/png";

    console.log("[image-proxy] success, size:", buffer.length);

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (error) {
    console.error("[image-proxy] error:", error);
    return Response.json({ error: "Image not found" }, { status: 404 });
  }
}
