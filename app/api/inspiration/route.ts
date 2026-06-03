import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

// 缓存 count 查询结果（30 秒 TTL），减少每次翻页时的 count 查询
const COUNT_CACHE_TTL = 30_000;
let inspirationCountCache: { total: number; expires: number } | null = null;

function getCachedInspirationCount(): number | null {
  if (inspirationCountCache && inspirationCountCache.expires > Date.now()) {
    return inspirationCountCache.total;
  }
  inspirationCountCache = null;
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  // 初始加载较少数量，避免页面卡顿，后续分页保持 12 张
  const pageSize = 12;
  const from = (page - 1) * pageSize;

  // Optional auth for checking like status
  let currentUserId: string | null = null;
  const authUser = getUserFromRequest(request);
  if (authUser) {
    currentUserId = authUser.uid;
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

  // 优先使用缓存的 count
  let total: number;
  const cachedTotal = getCachedInspirationCount();
  if (cachedTotal !== null) {
    total = cachedTotal;
  } else {
    const countResult = await serverDb
      .collection("generations")
      .where({ published: true })
      .count();
    total = countResult.total ?? 0;
    inspirationCountCache = { total, expires: Date.now() + COUNT_CACHE_TTL };
  }

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
