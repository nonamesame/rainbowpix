import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import app from "@/lib/cloudbase/server";
import { createHash } from "crypto";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

function generateAuthorUid(authorName: string): string {
  return "author_" + createHash("md5").update(authorName).digest("hex").slice(0, 16);
}

export async function GET(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  try {
    // Query both old "admin" uid and new "author_xxx" format
    const { data } = await serverDb
      .collection("generations")
      .where({
        user_id: /(^admin$|^author_)/,
      })
      .field([
        "_id", "prompt", "model", "image_url", "title", "username",
        "created_at", "likes_count", "published",
      ])
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    return Response.json({ items: data || [] });
  } catch (error) {
    console.error("List admin inspiration error:", error);
    return Response.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  const { id, likes_count } = await request.json();

  if (!id || likes_count === undefined) {
    return Response.json({ error: "缺少参数" }, { status: 400 });
  }

  const count = parseInt(likes_count, 10);
  if (isNaN(count) || count < 0) {
    return Response.json({ error: "点赞数必须是非负整数" }, { status: 400 });
  }

  try {
    await serverDb.collection("generations").doc(id).update({ likes_count: count });
    await logAdminAction("update_inspiration", { id, likes_count: count }, request);
    return Response.json({ success: true, likes_count: count });
  } catch (error) {
    console.error("Update likes_count error:", error);
    return Response.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prompt = formData.get("prompt") as string | null;
    const title = (formData.get("title") as string) || "";
    const model = (formData.get("model") as string) || "管理员上传";
    const author = (formData.get("author") as string) || "";

    if (!file || !prompt) {
      return Response.json({ error: "请选择图片并填写提示词" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "仅支持 JPG、PNG、GIF、WebP 格式" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: "文件大小不能超过 10MB" }, { status: 400 });
    }

    // Upload to CloudBase
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `inspiration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const cloudPath = `admin-inspiration/${fileName}`;

    const uploadRes = await app.uploadFile({ cloudPath, fileContent: buffer });
    const fileID = uploadRes.fileID;
    const imageUrl = `/api/images/${encodeURIComponent(fileID)}`;

    // Create generation record
    const authorName = author || "匿名用户";
    const authorUid = generateAuthorUid(authorName);

    const { id } = await serverDb.collection("generations").add({
      user_id: authorUid,
      username: authorName,
      prompt: prompt.trim(),
      model,
      title: title.trim() || null,
      image_url: imageUrl,
      published: true,
      watermark_enabled: false,
      likes_count: 0,
      source: "admin",
      reference_image_url: null,
      created_at: new Date().toISOString(),
    });

    await logAdminAction("create_inspiration", { title: title.trim() || null }, request);

    return Response.json({ id, image_url: imageUrl, prompt: prompt.trim(), model, title: title.trim() }, { status: 201 });
  } catch (error) {
    console.error("Admin inspiration upload error:", error);
    return Response.json({ error: "发布失败" }, { status: 500 });
  }
}
