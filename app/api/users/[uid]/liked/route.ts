import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  const { uid } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 12;
  const from = (page - 1) * pageSize;

  try {
    const { total: likesTotal } = await serverDb
      .collection("gallery_likes")
      .where({ user_id: uid })
      .count();

    const { data: likes } = await serverDb
      .collection("gallery_likes")
      .where({ user_id: uid })
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

    const { data: generations } = await serverDb
      .collection("generations")
      .where({ _id: { $in: generationIds } })
      .field([
        "prompt", "model", "image_url", "reference_image_url",
        "created_at", "user_id", "username", "likes_count",
        "watermark_enabled", "title",
      ])
      .get();

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
    console.error("Public liked works error:", error);
    return Response.json({ items: [], total: 0, page, pageSize, hasMore: false });
  }
}
