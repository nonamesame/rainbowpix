import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

// GET: List all fictional authors with their work counts
export async function GET(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  try {
    // Fetch all fictional authors from users collection
    const { data: users } = await serverDb
      .collection("users")
      .where({ uid: /fictional_author_/ })
      .field(["uid", "username", "avatar_url", "bio", "created_at"])
      .orderBy("uid", "asc")
      .limit(50)
      .get();

    if (!users || users.length === 0) {
      return Response.json({ authors: [] });
    }

    // For each author, count their works in generations collection
    const authorsWithCounts = await Promise.all(
      users.map(async (user: any) => {
        try {
          const countResult = await serverDb
            .collection("generations")
            .where({ user_id: user.uid })
            .count();
          return {
            uid: user.uid,
            username: user.username || "",
            avatar_url: user.avatar_url || "",
            bio: user.bio || "",
            works_count: countResult.total ?? 0,
            created_at: user.created_at || "",
          };
        } catch {
          return {
            uid: user.uid,
            username: user.username || "",
            avatar_url: user.avatar_url || "",
            bio: user.bio || "",
            works_count: 0,
            created_at: user.created_at || "",
          };
        }
      })
    );

    return Response.json({ authors: authorsWithCounts });
  } catch (error) {
    console.error("List authors error:", error);
    return Response.json({ error: "获取作者列表失败" }, { status: 500 });
  }
}

// PUT: Update author name and/or avatar, sync name to generations
export async function PUT(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  try {
    const { uid, username, avatar_url, bio } = await request.json();

    if (!uid) {
      return Response.json({ error: "缺少作者 UID" }, { status: 400 });
    }

    // Verify this is a fictional author
    if (!uid.startsWith("fictional_author_")) {
      return Response.json({ error: "只能编辑虚构作者" }, { status: 400 });
    }

    // Fetch current user record
    const { data: users } = await serverDb
      .collection("users")
      .where({ uid })
      .limit(1)
      .get();

    if (!users || users.length === 0) {
      return Response.json({ error: "作者不存在" }, { status: 404 });
    }

    const user = users[0] as any;
    const updateFields: Record<string, any> = {};

    // Update name if provided and different
    if (username && username !== user.username) {
      updateFields.username = username.trim();

      // Sync name to all generations by this author
      try {
        // CloudBase doesn't support $set in update, so we need to query and update individually
        const { data: generations } = await serverDb
          .collection("generations")
          .where({ user_id: uid })
          .field(["_id"])
          .limit(1000)
          .get();

        if (generations && generations.length > 0) {
          const batchUpdate = generations.map((gen: any) =>
            serverDb
              .collection("generations")
              .doc(gen._id)
              .update({ username: username.trim() })
          );
          await Promise.all(batchUpdate);
        }
      } catch (err) {
        console.error("Failed to sync username to generations:", err);
        // Continue with user update even if sync fails
      }
    }

    // Update avatar if provided
    if (avatar_url !== undefined) {
      updateFields.avatar_url = avatar_url.trim();
    }

    // Update bio if provided
    if (bio !== undefined) {
      updateFields.bio = bio.trim();
    }

    // Apply update to users collection
    if (Object.keys(updateFields).length > 0) {
      await serverDb.collection("users").doc(user._id).update(updateFields);
    }

    await logAdminAction("update_author", { uid, ...updateFields }, request);

    return Response.json({
      success: true,
      uid,
      ...updateFields,
    });
  } catch (error) {
    console.error("Update author error:", error);
    return Response.json({ error: "更新作者信息失败" }, { status: 500 });
  }
}
