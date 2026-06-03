import { decodeUserCookie } from "@/lib/utils";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { serverDb } from "@/lib/cloudbase/server";
import InspirationDetailClient from "@/components/InspirationDetailClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "灵感详情 - RainbowPix" };
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

  // Fetch item, like status, and author profile in parallel
  const generationQuery = serverDb
    .collection("generations")
    .where({ _id: id, published: true })
    .field([
      "prompt", "model", "image_url", "reference_image_url",
      "created_at", "user_id", "username", "likes_count",
      "watermark_enabled", "title", "comments_count",
      "width", "height",
    ])
    .limit(1)
    .get();

  // Derive author query from generation query result (runs in parallel via Promise.all)
  const authorQuery = generationQuery.then(({ data }: { data: any }) => {
    const uid = data?.[0]?.user_id;
    if (!uid) return Promise.resolve(null) as Promise<{ data: Record<string, unknown>[] } | null>;
    return serverDb
      .collection("users")
      .where({ uid })
      .field(["username", "avatar_url"])
      .limit(1)
      .get()
      .catch(() => null);
  });

  const [itemResult, likeResult, authorResult] = await Promise.all([
    generationQuery,
    likePromise,
    authorQuery,
  ]);

  const raw = itemResult.data?.[0];
  if (!raw) {
    notFound();
  }

  const userLiked = Array.isArray(likeResult?.data) && likeResult!.data.length > 0;

  const item = { ...raw, user_liked: userLiked };

  if (authorResult?.data && authorResult.data.length > 0) {
    if (authorResult.data[0].username) item.username = authorResult.data[0].username as string;
    item.author_avatar_url = (authorResult.data[0].avatar_url as string) || "";
  }

  return (
    <InspirationDetailClient
      item={item}
      currentUserId={currentUserId}
    />
  );
}
