import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import app from "@/lib/cloudbase/server";

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "未找到文件" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "仅支持 JPG、PNG、GIF、WebP 格式" }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return Response.json({ error: "头像大小不能超过 2MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `avatar-${user.uid}-${Date.now()}.${ext}`;
    const cloudPath = `avatars/${fileName}`;

    const uploadRes = await app.uploadFile({
      cloudPath,
      fileContent: buffer,
    });

    const fileID = uploadRes.fileID;
    const avatarUrl = `/api/images/${encodeURIComponent(fileID)}`;

    // Update users collection
    try {
      const { data } = await serverDb
        .collection("users")
        .where({ uid: user.uid })
        .limit(1)
        .get();

      if (data && data.length > 0) {
        // Delete old avatar file if exists
        const oldAvatar = data[0].avatar_url;
        if (oldAvatar) {
          try {
            const oldFileId = decodeURIComponent(oldAvatar.split("/api/images/")[1] || "");
            if (oldFileId) {
              await app.deleteFile({ fileList: [oldFileId] });
            }
          } catch {}
        }
        await serverDb.collection("users").doc(data[0]._id).update({ avatar_url: avatarUrl });
      } else {
        await serverDb.collection("users").add({
          uid: user.uid,
          username: user.username || "",
          email: user.email || "",
          phone: user.phone || "",
          bio: "",
          avatar_url: avatarUrl,
          created_at: new Date().toISOString(),
        });
      }
    } catch {}

    // Sync avatar to all comments
    try {
      const { data: comments } = await serverDb
        .collection("gallery_comments")
        .where({ user_id: user.uid })
        .field(["_id"])
        .get();
      if (comments && comments.length > 0) {
        for (const comment of comments) {
          await serverDb
            .collection("gallery_comments")
            .doc(comment._id)
            .update({ avatar_url: avatarUrl });
        }
      }
    } catch {}

    // Build updated cookie with avatar_url
    const updatedUser = {
      uid: user.uid,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatar_url: avatarUrl,
    };
    const cookiePayload = Buffer.from(JSON.stringify(updatedUser)).toString("base64");

    return Response.json({ avatar_url: avatarUrl, cookie: cookiePayload });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return Response.json({ error: "上传失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  try {
    const { data } = await serverDb
      .collection("users")
      .where({ uid: user.uid })
      .limit(1)
      .get();

    if (data && data.length > 0) {
      const oldAvatar = data[0].avatar_url;
      if (oldAvatar) {
        try {
          const oldFileId = decodeURIComponent(oldAvatar.split("/api/images/")[1] || "");
          if (oldFileId) {
            await app.deleteFile({ fileList: [oldFileId] });
          }
        } catch {}
      }
      await serverDb.collection("users").doc(data[0]._id).update({ avatar_url: "" });
    }

    // Sync avatar removal to all comments
    try {
      const { data: comments } = await serverDb
        .collection("gallery_comments")
        .where({ user_id: user.uid })
        .field(["_id"])
        .get();
      if (comments && comments.length > 0) {
        for (const comment of comments) {
          await serverDb
            .collection("gallery_comments")
            .doc(comment._id)
            .update({ avatar_url: "" });
        }
      }
    } catch {}

    const updatedUser = {
      uid: user.uid,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatar_url: "",
    };
    const cookiePayload = Buffer.from(JSON.stringify(updatedUser)).toString("base64");

    return Response.json({ success: true, cookie: cookiePayload });
  } catch (error) {
    console.error("Avatar delete error:", error);
    return Response.json({ error: "删除失败" }, { status: 500 });
  }
}
