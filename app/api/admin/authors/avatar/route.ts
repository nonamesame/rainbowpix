import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import app from "@/lib/cloudbase/server";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

// POST: Upload author avatar
export async function POST(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const uid = formData.get("uid") as string | null;

    if (!file || !uid) {
      return Response.json({ error: "缺少文件或作者 UID" }, { status: 400 });
    }

    if (!uid.startsWith("fictional_author_")) {
      return Response.json({ error: "只能编辑虚构作者" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "仅支持 JPG、PNG、GIF、WebP 格式" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "头像大小不能超过 5MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `author-avatar-${uid}-${Date.now()}.${ext}`;
    const cloudPath = `author-avatars/${fileName}`;

    const uploadRes = await app.uploadFile({ cloudPath, fileContent: buffer });
    const fileID = uploadRes.fileID;
    const avatarUrl = `/api/images/${encodeURIComponent(fileID)}`;

    // Update user record
    try {
      const { data: users } = await serverDb
        .collection("users")
        .where({ uid })
        .limit(1)
        .get();

      if (users && users.length > 0) {
        // Delete old avatar file if exists
        const oldAvatar = (users[0] as any).avatar_url;
        if (oldAvatar && oldAvatar.includes("/api/images/")) {
          try {
            const oldFileId = decodeURIComponent(oldAvatar.split("/api/images/")[1] || "");
            if (oldFileId) {
              await app.deleteFile({ fileList: [oldFileId] });
            }
          } catch {}
        }
        await serverDb.collection("users").doc((users[0] as any)._id).update({ avatar_url: avatarUrl });
      }
    } catch (err) {
      console.error("Failed to update user avatar:", err);
    }

    await logAdminAction("update_author_avatar", { uid }, request);

    return Response.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error("Author avatar upload error:", error);
    return Response.json({ error: "上传失败" }, { status: 500 });
  }
}
