import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let user: { uid: string };
  try {
    user = JSON.parse(atob(userPayload));
  } catch {
    return Response.json({ error: "登录信息无效" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 12;
  const from = (page - 1) * pageSize;

  try {
    const { data } = await serverDb
      .collection("generations")
      .where({ user_id: user.uid, published: true })
      .field([
        "prompt", "model", "image_url", "reference_image_url",
        "created_at", "user_id", "username", "likes_count",
        "watermark_enabled", "title",
      ])
      .orderBy("created_at", "desc")
      .skip(from)
      .limit(pageSize)
      .get();

    const { total } = await serverDb
      .collection("generations")
      .where({ user_id: user.uid, published: true })
      .count();

    let items = (data || []).map((item: any) => ({ ...item, user_liked: false }));

    // Check which items the current user has liked
    if (items.length > 0) {
      try {
        const generationIds = items.map((item: any) => item._id);
        const { data: likes } = await serverDb
          .collection("gallery_likes")
          .where({
            user_id: user.uid,
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
      }
    }

    return Response.json({
      items,
      total: total ?? 0,
      page,
      pageSize,
      hasMore: from + pageSize < (total ?? 0),
    });
  } catch (error) {
    console.error("Published works error:", error);
    return Response.json({ items: [], total: 0, page, pageSize, hasMore: false });
  }
}
