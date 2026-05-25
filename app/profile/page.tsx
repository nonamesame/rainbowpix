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
    user = JSON.parse(atob(userCookie));
  } catch {
    redirect("/login");
  }

  // Fetch profile data (handle case where users collection doesn't exist)
  let profileData: any = null;
  try {
    const { data: users } = await serverDb
      .collection("users")
      .where({ uid: user.uid })
      .limit(1)
      .get();
    profileData = users?.[0];
  } catch {
    // users collection may not exist yet, use cookie data as fallback
  }

  const profile = profileData || {
    uid: user.uid,
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    bio: "",
    created_at: "",
  };

  // Fetch first page of all works
  const { data: works } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid })
    .field(["prompt", "model", "image_url", "reference_image_url", "created_at", "published", "watermark_enabled", "likes_count"])
    .orderBy("created_at", "desc")
    .skip(0)
    .limit(12)
    .get();

  const { total: worksTotal } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid })
    .count();

  // Fetch first page of published works
  const { data: published } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid, published: true })
    .field(["prompt", "model", "image_url", "reference_image_url", "created_at", "user_id", "username", "likes_count", "watermark_enabled", "title"])
    .orderBy("created_at", "desc")
    .skip(0)
    .limit(12)
    .get();

  const { total: publishedTotal } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid, published: true })
    .count();

  // Check like status for published items
  let publishedItems = (published || []).map((item: any) => ({ ...item, user_liked: false }));
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

  // Fetch first page of liked works
  let likedItems: any[] = [];
  let likedTotal = 0;
  try {
    const { data: userLikes } = await serverDb
      .collection("gallery_likes")
      .where({ user_id: user.uid })
      .orderBy("created_at", "desc")
      .skip(0)
      .limit(12)
      .get();

    const { total: userLikesTotal } = await serverDb
      .collection("gallery_likes")
      .where({ user_id: user.uid })
      .count();

    likedTotal = userLikesTotal ?? 0;

    if (userLikes && userLikes.length > 0) {
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
    }
  } catch {
    // gallery_likes collection may not exist yet
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
        created_at: profile.created_at || "",
      }}
      initialWorks={works || []}
      worksTotal={worksTotal ?? 0}
      initialPublished={publishedItems}
      publishedTotal={publishedTotal ?? 0}
      initialLiked={likedItems}
      likedTotal={likedTotal}
    />
  );
}
