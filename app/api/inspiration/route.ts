import { decodeUserCookie } from "@/lib/utils";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 20;
  const from = (page - 1) * pageSize;

  // Optional auth for checking like status
  let currentUserId: string | null = null;
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (userPayload) {
    try {
      const user = decodeUserCookie(userPayload);
      currentUserId = user.uid;
    } catch {}
  }

  const { data } = await serverDb
    .collection("generations")
    .where({ published: true })
    .field([
      "prompt", "model", "image_url", "reference_image_url",
      "created_at", "user_id", "username", "likes_count",
      "watermark_enabled", "title", "comments_count", "width", "height",
    ])
    .orderBy("created_at", "desc")
    .skip(from)
    .limit(pageSize)
    .get();

  const { total } = await serverDb
    .collection("generations")
    .where({ published: true })
    .count();

  let items = data || [];

  // Check which items the current user has liked
  if (currentUserId && items.length > 0) {
    try {
      const generationIds = items.map((item: any) => item._id);
      const { data: likes } = await serverDb
        .collection("gallery_likes")
        .where({
          user_id: currentUserId,
          generation_id: { $in: generationIds },
        })
        .get();

      const likedSet = new Set((likes || []).map((l: any) => l.generation_id));
      items = items.map((item: any) => ({
        ...item,
        user_liked: likedSet.has(item._id),
      }));
    } catch {
      // gallery_likes collection may not exist yet
      items = items.map((item: any) => ({ ...item, user_liked: false }));
    }
  } else {
    items = items.map((item: any) => ({ ...item, user_liked: false }));
  }

  return Response.json({
    items,
    total: total ?? 0,
    page,
    pageSize,
    hasMore: from + pageSize < (total ?? 0),
  });
}
