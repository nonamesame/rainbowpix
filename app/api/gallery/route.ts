import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

// 缓存每个用户的 gallery count 查询结果（30 秒 TTL）
const GALLERY_COUNT_CACHE_TTL = 30_000;
const galleryCountCache = new Map<string, { total: number; expires: number }>();

function getCachedGalleryCount(userId: string): number | null {
  const cached = galleryCountCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.total;
  }
  if (cached) galleryCountCache.delete(userId);
  return null;
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 12;
  const from = (page - 1) * pageSize;
  const promptFilter = searchParams.get("prompt");
  const sinceParam = searchParams.get("since");

  const whereClause: Record<string, unknown> = { user_id: user.uid };
  if (promptFilter) whereClause.prompt = promptFilter;
  if (sinceParam) whereClause.created_at = { $gte: sinceParam };

  const { data } = await serverDb
    .collection("generations")
    .where(whereClause)
    .field(["prompt", "model", "image_url", "reference_image_url", "created_at", "published", "watermark_enabled", "likes_count"])
    .orderBy("created_at", "desc")
    .skip(from)
    .limit(pageSize)
    .get();

  // 优先使用缓存的 count（仅无筛选条件时缓存）
  let total: number;
  if (!promptFilter && !sinceParam) {
    const cached = getCachedGalleryCount(user.uid);
    if (cached !== null) {
      total = cached;
    } else {
      const countResult = await serverDb
        .collection("generations")
        .where({ user_id: user.uid })
        .count();
      total = countResult.total ?? 0;
      galleryCountCache.set(user.uid, { total, expires: Date.now() + GALLERY_COUNT_CACHE_TTL });
    }
  } else {
    const countResult = await serverDb
      .collection("generations")
      .where({ user_id: user.uid })
      .count();
    total = countResult.total ?? 0;
  }

  return Response.json({
    items: data || [],
    total,
    page,
    pageSize,
    hasMore: from + pageSize < total,
  });
}
