import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 12;
  const from = (page - 1) * pageSize;

  try {
    // Get total count first
    const { total: likesTotal } = await serverDb
      .collection("gallery_likes")
      .where({ user_id: user.uid })
      .count();

    // Get all generation IDs the user has liked
    const { data: likes } = await serverDb
      .collection("gallery_likes")
      .where({ user_id: user.uid })
      .orderBy("created_at", "desc")
      .skip(from)
      .limit(pageSize)
      .get();

    if (!likes || likes.length === 0) {
      return Response.json({
        items: [],
        total: likesTotal ?? 0,
        page,
        pageSize,
        hasMore: false,
      });
    }

    const generationIds = likes.map((like: any) => like.generation_id);

    // Fetch the actual generations
    const { data: generations } = await serverDb
      .collection("generations")
      .where({ _id: { $in: generationIds } })
      .field([
        "prompt", "model", "image_url", "reference_image_url",
        "created_at", "user_id", "username", "likes_count",
        "watermark_enabled", "title",
      ])
      .get();

    // Preserve the order from likes (newest first)
    const genMap = new Map((generations || []).map((g: any) => [g._id, g]));
    const items = generationIds
      .map((id: string) => {
        const gen = genMap.get(id);
        if (!gen) return null;
        return { ...gen, user_liked: true };
      })
      .filter(Boolean);

    return Response.json({
      items,
      total: likesTotal ?? 0,
      page,
      pageSize,
      hasMore: from + pageSize < (likesTotal ?? 0),
    });
  } catch (error) {
    console.error("Liked works error:", error);
    return Response.json({ items: [], total: 0, page, pageSize, hasMore: false });
  }
}
