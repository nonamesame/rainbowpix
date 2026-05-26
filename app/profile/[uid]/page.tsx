import { decodeUserCookie } from "@/lib/utils";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { serverDb } from "@/lib/cloudbase/server";
import ProfileClient from "@/components/ProfileClient";

export const revalidate = 0;

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;

  // Parallel: profile + published works + published count
  const [profileResult, publishedResult, publishedCountResult] = await Promise.all([
    serverDb.collection("users").where({ uid }).limit(1).get().catch(() => ({ data: [] })),
    serverDb.collection("generations")
      .where({ user_id: uid, published: true })
      .field([
        "prompt", "model", "image_url", "reference_image_url",
        "created_at", "user_id", "username", "likes_count",
        "watermark_enabled", "title",
      ])
      .orderBy("created_at", "desc").skip(0).limit(12).get().catch(() => ({ data: [] })),
    serverDb.collection("generations")
      .where({ user_id: uid, published: true }).count().catch(() => ({ total: 0 })),
  ]);

  let profileData = profileResult.data?.[0] || null;

  // Fallback: check generations for a username
  if (!profileData) {
    try {
      const { data: fallback } = await serverDb
        .collection("generations")
        .where({ user_id: uid, published: true })
        .field(["username"])
        .limit(1)
        .get();
      if (fallback?.[0]?.username) {
        profileData = { uid, username: fallback[0].username, bio: "", created_at: "" };
      }
    } catch {
      // ignore
    }
  }

  if (!profileData) {
    notFound();
  }

  const profile = {
    uid: profileData.uid,
    username: profileData.username || "",
    email: "",
    phone: "",
    bio: profileData.bio || "",
    avatar_url: profileData.avatar_url || "",
    created_at: profileData.created_at || "",
    show_liked: profileData.show_liked ?? false,
  };

  const published = publishedResult.data || [];
  const publishedTotal = publishedCountResult.total ?? 0;

  // Check like status for published items (if viewer is logged in)
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("tcb_user")?.value;
  let currentUserId: string | undefined;
  if (userCookie) {
    try {
      const viewer = decodeUserCookie(userCookie);
      currentUserId = viewer.uid;
    } catch {
      // ignore
    }
  }

  let publishedItems = published.map((item: any) => ({ ...item, user_liked: false }));
  if (userCookie && publishedItems.length > 0) {
    try {
      const viewer = decodeUserCookie(userCookie);
      const generationIds = publishedItems.map((item: any) => item._id);
      const { data: likes } = await serverDb
        .collection("gallery_likes")
        .where({
          user_id: viewer.uid,
          generation_id: { $in: generationIds },
        })
        .get();

      const likedSet = new Set((likes || []).map((l: any) => l.generation_id));
      publishedItems = publishedItems.map((item: any) => ({
        ...item,
        user_liked: likedSet.has(item._id),
      }));
    } catch {
      // ignore
    }
  }

  // Fetch liked works if show_liked is enabled
  let likedItems: any[] = [];
  let likedTotal = 0;
  if (profile.show_liked) {
    try {
      const { data: likesResult } = await serverDb
        .collection("gallery_likes")
        .where({ user_id: uid })
        .orderBy("created_at", "desc").skip(0).limit(12).get().catch(() => ({ data: [] }));

      const userLikes = likesResult || [];

      if (userLikes.length > 0) {
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
      }
    } catch {
      // ignore
    }
  }

  const dummyUser = { uid, username: profile.username };

  return (
    <ProfileClient
      user={dummyUser}
      profile={profile}
      initialWorks={[]}
      worksTotal={0}
      initialPublished={publishedItems}
      publishedTotal={publishedTotal}
      initialLiked={likedItems}
      likedTotal={likedTotal}
      isOwner={currentUserId === uid}
      publicUid={uid}
    />
  );
}
