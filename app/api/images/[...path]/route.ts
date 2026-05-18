import { NextRequest, NextResponse } from "next/server";
import app from "@/lib/cloudbase/server";
import fs from "fs";
import os from "os";
import path from "path";

export async function _GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const cloudPath = segments.join("/");

  if (!cloudPath || !cloudPath.startsWith("generated-images/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const tmpDir = path.join(os.tmpdir(), "tcb-images");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, cloudPath.replace(/\//g, "_"));

  try {
    await app.downloadFile({
      fileID: cloudPath,
      tempFilePath: tmpFile,
    });

    const buffer = fs.readFileSync(tmpFile);
    fs.unlinkSync(tmpFile);

    const ext = cloudPath.split(".").pop()?.toLowerCase() || "png";
    const contentType =
      { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[ext] || "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (error) {
    const tmpExists = fs.existsSync(tmpFile);
    if (tmpExists) fs.unlinkSync(tmpFile);
    console.error("Image proxy error:", error);
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}

export const GET = _GET;
