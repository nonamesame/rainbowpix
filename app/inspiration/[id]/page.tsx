import { decodeUserCookie } from "@/lib/utils";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { serverDb } from "@/lib/cloudbase/server";
import InspirationDetailClient from "@/components/InspirationDetailClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const { data } = await serverDb
      .collection("generations")
      .where({ _id: id, published: true })
      .field(["title", "username", "prompt"])
      .limit(1)
      .get();
    const item = data?.[0];
    if (!item) return { title: "灵感详情 - RainbowPix" };
    return {
      title: `${item.title || item.username || "灵感详情"} - RainbowPix`,
      description: item.prompt?.slice(0, 160),
    };
  } catch {
    return { title: "灵感详情 - RainbowPix" };
  }
}

export default async function InspirationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Parse user cookie early for parallel queries
  const cookieStore = await cookies();
  const userPayload = cookieStore.get("tcb_user")?.value;
  let currentUserId: string | undefined;
  let likePromise: Promise<{ data: unknown[] } | null> = Promise.resolve(null);

  if (userPayload) {
    try {
      const user = decodeUserCookie(userPayload);
      currentUserId = user.uid;
      likePromise = serverDb
        .collection("gallery_likes")
        .where({ user_id: user.uid, generation_id: id })
        .limit(1)
        .get();
    } catch {
      // ignore
    }
  }

  // Fetch item and like status in parallel
  const [itemResult, likeResult] = await Promise.all([
    serverDb
      .collection("generations")
      .where({ _id: id, published: true })
      .field([
        "prompt", "model", "image_url", "reference_image_url",
        "created_at", "user_id", "username", "likes_count",
        "watermark_enabled", "title", "comments_count",
        "width", "height",
      ])
      .limit(1)
      .get(),
    likePromise,
  ]);

  const raw = itemResult.data?.[0];
  if (!raw) {
    notFound();
  }

  const userLiked = Array.isArray(likeResult?.data) && likeResult!.data.length > 0;

  const item = { ...raw, user_liked: userLiked };

  // Fetch author's latest profile from users collection
  try {
    const { data: authorData } = await serverDb
      .collection("users")
      .where({ uid: item.user_id })
      .field(["username", "avatar_url"])
      .limit(1)
      .get();
    if (authorData && authorData.length > 0) {
      if (authorData[0].username) item.username = authorData[0].username;
      item.author_avatar_url = authorData[0].avatar_url || "";
    }
  } catch {
    // users collection may not exist
  }

  return (
    <InspirationDetailClient
      item={item}
      currentUserId={currentUserId}
    />
  );
}
