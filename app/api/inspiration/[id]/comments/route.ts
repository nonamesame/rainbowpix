import { decodeUserCookie } from "@/lib/utils";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";
import { getDisplayName } from "@/lib/inspiration";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 20;
  const from = (page - 1) * pageSize;

  const { id: generationId } = await params;

  // Optional auth for checking like status
  let currentUserId: string | null = null;
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (userPayload) {
    try {
      const user = decodeUserCookie(userPayload);
      currentUserId = user.uid;
    } catch {}
  }

  // Verify generation exists and is published
  const { data: genData } = await serverDb
    .collection("generations")
    .where({ _id: generationId, published: true })
    .field(["_id"])
    .get();

  if (!genData || genData.length === 0) {
    return Response.json({ error: "未找到" }, { status: 404 });
  }

  const { data } = await serverDb
    .collection("gallery_comments")
    .where({ generation_id: generationId })
    .field(["user_id", "username", "avatar_url", "content", "likes_count", "created_at"])
    .orderBy("created_at", "desc")
    .skip(from)
    .limit(pageSize)
    .get();

  const { total } = await serverDb
    .collection("gallery_comments")
    .where({ generation_id: generationId })
    .count();

  let items = data || [];

  // Fetch latest username and avatar from users collection
  if (items.length > 0) {
    try {
      const userIds = [...new Set(items.map((c: any) => c.user_id))];
      const { data: users } = await serverDb
        .collection("users")
        .where({ uid: { $in: userIds } })
        .field(["uid", "username", "avatar_url"])
        .get();
      const userMap = new Map((users || []).map((u: any) => [u.uid, u]));
      items = items.map((item: any) => {
        const user = userMap.get(item.user_id);
        if (user) {
          return {
            ...item,
            username: user.username || item.username,
            avatar_url: user.avatar_url || item.avatar_url,
          };
        }
        return item;
      });
    } catch {
      // users collection may not exist yet, keep denormalized data
    }
  }

  // Check which comments the current user has liked
  if (currentUserId && items.length > 0) {
    try {
      const commentIds = items.map((c: any) => c._id);
      const { data: likes } = await serverDb
        .collection("gallery_comment_likes")
        .where({
          user_id: currentUserId,
          comment_id: { $in: commentIds },
        })
        .get();

      const likedSet = new Set((likes || []).map((l: any) => l.comment_id));
      items = items.map((item: any) => ({
        ...item,
        user_liked: likedSet.has(item._id),
      }));
    } catch {
      items = items.map((item: any) => ({ ...item, user_liked: false }));
    }
  } else {
    items = items.map((item: any) => ({ ...item, user_liked: false }));
  }

  return Response.json({
    items,
    total: total ?? 0,
    page,
    hasMore: from + pageSize < (total ?? 0),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const userPayload = request.cookies.get("tcb_user")?.value;
  let fullUser: { uid: string; email?: string; phone?: string; username?: string; avatar_url?: string } = user as any;
  if (userPayload) {
    try {
      fullUser = decodeUserCookie(userPayload);
    } catch {}
  }

  const { id: generationId } = await params;

  // Parse request body
  let content: string;
  try {
    const body = await request.json();
    content = (body.content || "").trim();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!content) {
    return Response.json({ error: "评论内容不能为空" }, { status: 400 });
  }
  if (content.length > 500) {
    return Response.json({ error: "评论内容不能超过 500 字" }, { status: 400 });
  }

  // Verify generation exists and is published
  const { data: genData } = await serverDb
    .collection("generations")
    .where({ _id: generationId, published: true })
    .field(["user_id", "username", "title", "prompt"])
    .get();

  if (!genData || genData.length === 0) {
    return Response.json({ error: "未找到" }, { status: 404 });
  }

  const generation = genData[0];

  // Fetch latest user info from users collection to ensure accurate display
  let latestUsername = getDisplayName(fullUser);
  let latestAvatarUrl = fullUser.avatar_url || null;
  try {
    const { data: userData } = await serverDb
      .collection("users")
      .where({ uid: user.uid })
      .field(["username", "avatar_url"])
      .limit(1)
      .get();
    if (userData && userData.length > 0) {
      latestUsername = userData[0].username || latestUsername;
      latestAvatarUrl = userData[0].avatar_url || latestAvatarUrl;
    }
  } catch {
    // users collection may not exist yet, keep cookie data
  }

  // Create comment
  const comment = {
    user_id: user.uid,
    username: latestUsername,
    avatar_url: latestAvatarUrl,
    generation_id: generationId,
    content,
    likes_count: 0,
    created_at: new Date().toISOString(),
  };

  const { id: commentId } = await serverDb.collection("gallery_comments").add(comment);

  // Atomically increment comments_count
  await serverDb.collection("generations").doc(generationId).update({
    comments_count: serverDb.command.inc(1),
  });

  // Re-read for accurate count
  const { data: updatedGen } = await serverDb
    .collection("generations")
    .where({ _id: generationId })
    .field(["comments_count"])
    .get();
  const commentsCount = updatedGen?.[0]?.comments_count || 0;

  // Send notification to owner (if not self-comment)
  if (generation.user_id !== user.uid) {
    const workName = generation.title || (generation.prompt?.length > 10 ? generation.prompt.slice(0, 10) + "..." : generation.prompt) || "作品";
    await serverDb.collection("notifications").add({
      user_id: generation.user_id,
      type: "comment",
      title: "收到评论",
      body: `${getDisplayName(fullUser)} 评论了你的「${workName}」`,
      link: "/",
      image: null,
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  return Response.json({
    comment: { ...comment, _id: commentId, user_liked: false },
    comments_count: commentsCount,
  });
}
