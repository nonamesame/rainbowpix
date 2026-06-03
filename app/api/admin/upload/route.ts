import { NextRequest } from "next/server";
import app from "@/lib/cloudbase/server";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "未找到文件" }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "仅支持 JPG、PNG、GIF、WebP 格式" }, { status: 400 });
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "文件大小不能超过 5MB" }, { status: 400 });
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上传到 CloudBase
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `announcement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const cloudPath = `announcement-images/${fileName}`;

    const uploadRes = await app.uploadFile({
      cloudPath,
      fileContent: buffer,
    });

    const fileID = uploadRes.fileID;
    const imageUrl = `/api/images/${encodeURIComponent(fileID)}`;

    console.log("Upload success:", { fileID, imageUrl });

    await logAdminAction("upload_image", { filename: file.name }, request);

    // 直接返回 fileID 用于调试
    return Response.json({ url: imageUrl, fileID, raw: uploadRes }, { status: 200 });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ error: "上传失败" }, { status: 500 });
  }
}
