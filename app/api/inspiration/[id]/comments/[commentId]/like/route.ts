import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";
import { decodeUserCookie } from "@/lib/utils";
import { getDisplayName } from "@/lib/inspiration";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { commentId } = await params;

  // Verify comment exists
  const { data: commentData } = await serverDb
    .collection("gallery_comments")
    .where({ _id: commentId })
    .field(["_id"])
    .get();

  if (!commentData || commentData.length === 0) {
    return Response.json({ error: "评论不存在" }, { status: 404 });
  }

  // Check if already liked
  let alreadyLiked = false;
  let existingLikeId: string | null = null;
  try {
    const { data: existingLikes } = await serverDb
      .collection("gallery_comment_likes")
      .where({ user_id: user.uid, comment_id: commentId })
      .get();
    alreadyLiked = !!(existingLikes && existingLikes.length > 0);
    if (alreadyLiked) {
      existingLikeId = existingLikes![0]._id;
    }
  } catch {
    // gallery_comment_likes collection may not exist yet
  }

  if (alreadyLiked && existingLikeId) {
    // Unlike
    await serverDb.collection("gallery_comment_likes").doc(existingLikeId).delete();
    await serverDb.collection("gallery_comments").doc(commentId).update({
      likes_count: serverDb.command.inc(-1),
    });
    const { data: updatedComment } = await serverDb
      .collection("gallery_comments")
      .where({ _id: commentId })
      .field(["likes_count"])
      .get();
    const finalCount = Math.max(0, updatedComment?.[0]?.likes_count || 0);
    return Response.json({ liked: false, likes_count: finalCount });
  } else {
    // Like
    await serverDb.collection("gallery_comment_likes").add({
      user_id: user.uid,
      comment_id: commentId,
      created_at: new Date().toISOString(),
    });
    await serverDb.collection("gallery_comments").doc(commentId).update({
      likes_count: serverDb.command.inc(1),
    });
    const { data: updatedComment } = await serverDb
      .collection("gallery_comments")
      .where({ _id: commentId })
      .field(["likes_count", "user_id", "content", "generation_id"])
      .get();
    const finalCount = updatedComment?.[0]?.likes_count || 0;

    // Send notification to comment owner (if not self-like)
    const commentDoc = updatedComment?.[0];
    if (commentDoc && commentDoc.user_id !== user.uid) {
      const userPayload = request.cookies.get("tcb_user")?.value;
      let fullUser: { uid: string; email?: string; phone?: string } = user;
      if (userPayload) {
        try { fullUser = decodeUserCookie(userPayload); } catch {}
      }
      const snippet = commentDoc.content?.length > 20 ? commentDoc.content.slice(0, 20) + "..." : commentDoc.content || "评论";
      await serverDb.collection("notifications").add({
        user_id: commentDoc.user_id,
        type: "comment_like",
        title: "评论获赞",
        body: `${getDisplayName(fullUser)} 赞了你的评论「${snippet}」`,
        link: `/inspiration/${commentDoc.generation_id}`,
        image: null,
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ liked: true, likes_count: finalCount });
  }
}
