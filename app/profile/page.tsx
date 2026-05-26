import { decodeUserCookie } from "@/lib/utils";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { serverDb } from "@/lib/cloudbase/server";
import ProfileClient from "@/components/ProfileClient";

export const revalidate = 0;

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("tcb_user")?.value;

  if (!userCookie) {
    redirect("/login");
  }

  let user: { uid: string; email?: string; phone?: string; username?: string };
  try {
    user = decodeUserCookie(userCookie);
  } catch {
    redirect("/login");
  }

  // Parallel: fetch profile + all works + published works + liked works
  const [
    profileResult,
    worksResult,
    worksCountResult,
    publishedResult,
    publishedCountResult,
    likesResult,
    likesCountResult,
  ] = await Promise.all([
    // Profile
    serverDb.collection("users").where({ uid: user.uid }).limit(1).get().catch(() => ({ data: [] })),
    // All works (first page)
    serverDb.collection("generations")
      .where({ user_id: user.uid })
      .field(["prompt", "model", "image_url", "reference_image_url", "created_at", "published", "watermark_enabled", "likes_count"])
      .orderBy("created_at", "desc").skip(0).limit(12).get().catch(() => ({ data: [] })),
    // All works count
    serverDb.collection("generations").where({ user_id: user.uid }).count().catch(() => ({ total: 0 })),
    // Published works (first page)
    serverDb.collection("generations")
      .where({ user_id: user.uid, published: true })
      .field(["prompt", "model", "image_url", "reference_image_url", "created_at", "user_id", "username", "likes_count", "watermark_enabled", "title"])
      .orderBy("created_at", "desc").skip(0).limit(12).get().catch(() => ({ data: [] })),
    // Published count
    serverDb.collection("generations").where({ user_id: user.uid, published: true }).count().catch(() => ({ total: 0 })),
    // Liked works (first page)
    serverDb.collection("gallery_likes")
      .where({ user_id: user.uid })
      .orderBy("created_at", "desc").skip(0).limit(12).get().catch(() => ({ data: [] })),
    // Liked count
    serverDb.collection("gallery_likes").where({ user_id: user.uid }).count().catch(() => ({ total: 0 })),
  ]);

  const profileData = profileResult.data?.[0] || null;
  const profile = profileData || {
    uid: user.uid,
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    bio: "",
    created_at: "",
  };

  const works = worksResult.data || [];
  const worksTotal = worksCountResult.total ?? 0;

  const published = publishedResult.data || [];
  const publishedTotal = publishedCountResult.total ?? 0;

  // Check like status for published items
  let publishedItems = published.map((item: any) => ({ ...item, user_liked: false }));
  if (publishedItems.length > 0) {
    try {
      const generationIds = publishedItems.map((item: any) => item._id);
      const { data: likes } = await serverDb
        .collection("gallery_likes")
        .where({
          user_id: user.uid,
          generation_id: { $in: generationIds },
        })
        .get();

      const likedSet = new Set((likes || []).map((l: any) => l.generation_id));
      publishedItems = publishedItems.map((item: any) => ({
        ...item,
        user_liked: likedSet.has(item._id),
      }));
    } catch {
      // gallery_likes collection may not exist yet
    }
  }

  // Process liked works
  const userLikes = likesResult.data || [];

  let likedItems: any[] = [];
  let likedTotal = 0;
  if (userLikes.length > 0) {
    try {
      const likedGenerationIds = userLikes.map((l: any) => l.generation_id);
      const { data: likedGenerations } = await serverDb
        .collection("generations")
        .where({ _id: { $in: likedGenerationIds } })
        .field([
          "prompt", "model", "image_url", "reference_image_url",
          "created_at", "user_id", "username", "likes_count",
          "watermark_enabled", "title",
        ])
        .get();

      const genMap = new Map((likedGenerations || []).map((g: any) => [g._id, g]));
      likedItems = likedGenerationIds
        .map((id: string) => {
          const gen = genMap.get(id);
          if (!gen) return null;
          return { ...gen, user_liked: true };
        })
        .filter(Boolean);
      likedTotal = likedItems.length;
    } catch {
      // ignore
    }
  }

  return (
    <ProfileClient
      user={user}
      profile={{
        uid: profile.uid,
        username: profile.username || user.username || "",
        email: profile.email || user.email || "",
        phone: profile.phone || user.phone || "",
        bio: profile.bio || "",
        avatar_url: profile.avatar_url || "",
        created_at: profile.created_at || "",
        show_liked: profile.show_liked ?? false,
      }}
      initialWorks={works}
      worksTotal={worksTotal}
      initialPublished={publishedItems}
      publishedTotal={publishedTotal}
      initialLiked={likedItems}
      likedTotal={likedTotal}
    />
  );
}
