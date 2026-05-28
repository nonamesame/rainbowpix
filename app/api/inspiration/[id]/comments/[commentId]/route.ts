import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id: generationId, commentId } = await params;

  // Fetch the comment and verify ownership
  const { data: commentData } = await serverDb
    .collection("gallery_comments")
    .where({ _id: commentId, generation_id: generationId })
    .field(["user_id"])
    .get();

  if (!commentData || commentData.length === 0) {
    return Response.json({ error: "评论不存在" }, { status: 404 });
  }

  if (commentData[0].user_id !== user.uid) {
    return Response.json({ error: "只能删除自己的评论" }, { status: 403 });
  }

  // Delete the comment
  await serverDb.collection("gallery_comments").doc(commentId).delete();

  // Clean up associated likes
  try {
    const { data: likes } = await serverDb
      .collection("gallery_comment_likes")
      .where({ comment_id: commentId })
      .get();
    if (likes && likes.length > 0) {
      for (const like of likes) {
        await serverDb.collection("gallery_comment_likes").doc(like._id).delete();
      }
    }
  } catch {
    // gallery_comment_likes collection may not exist yet
  }

  // Atomically decrement comments_count
  await serverDb.collection("generations").doc(generationId).update({
    comments_count: serverDb.command.inc(-1),
  });

  // Re-read for accurate count
  const { data: updatedGen } = await serverDb
    .collection("generations")
    .where({ _id: generationId })
    .field(["comments_count"])
    .get();
  const commentsCount = Math.max(0, updatedGen?.[0]?.comments_count || 0);

  return Response.json({ comments_count: commentsCount });
}
