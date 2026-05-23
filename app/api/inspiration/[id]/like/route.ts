import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";
import { getDisplayName } from "@/lib/inspiration";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  // Get full user info for display name
  const userPayload = request.cookies.get("tcb_user")?.value;
  let fullUser: { uid: string; email?: string; phone?: string } = user;
  if (userPayload) {
    try {
      fullUser = JSON.parse(atob(userPayload));
    } catch {}
  }

  const { id: generationId } = await params;

  // Check if the generation exists and is published
  const { data: genData } = await serverDb
    .collection("generations")
    .where({ _id: generationId, published: true })
    .field(["user_id", "likes_count", "username", "title", "prompt"])
    .get();

  if (!genData || genData.length === 0) {
    return Response.json({ error: "未找到" }, { status: 404 });
  }

  const generation = genData[0];

  // Check if already liked
  let alreadyLiked = false;
  let existingLikeId: string | null = null;
  try {
    const { data: existingLikes } = await serverDb
      .collection("gallery_likes")
      .where({ user_id: user.uid, generation_id: generationId })
      .get();
    alreadyLiked = !!(existingLikes && existingLikes.length > 0);
    if (alreadyLiked) {
      existingLikeId = existingLikes![0]._id;
    }
  } catch {
    // gallery_likes collection may not exist yet, treat as not liked
  }

  if (alreadyLiked && existingLikeId) {
    // Unlike
    await serverDb.collection("gallery_likes").doc(existingLikeId).delete();
    await serverDb.collection("generations").doc(generationId).update({
      likes_count: Math.max(0, (generation.likes_count || 1) - 1),
    });
    return Response.json({ liked: false, likes_count: Math.max(0, (generation.likes_count || 1) - 1) });
  } else {
    // Like
    await serverDb.collection("gallery_likes").add({
      user_id: user.uid,
      generation_id: generationId,
      created_at: new Date().toISOString(),
    });
    const newCount = (generation.likes_count || 0) + 1;
    await serverDb.collection("generations").doc(generationId).update({
      likes_count: newCount,
    });

    // Send notification to the generation owner (if not self-like)
    if (generation.user_id !== user.uid) {
      const workName = generation.title || (generation.prompt?.length > 10 ? generation.prompt.slice(0, 10) + "..." : generation.prompt) || "作品";
      await serverDb.collection("notifications").add({
        user_id: generation.user_id,
        type: "like",
        title: "收到点赞",
        body: `${getDisplayName(fullUser)} 赞了你的「${workName}」`,
        link: "/",
        image: null,
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ liked: true, likes_count: newCount });
  }
}
