import { cookies } from "next/headers";
import { serverDb } from "@/lib/cloudbase/server";
import InspirationGalleryClient from "@/components/InspirationGalleryClient";

export const revalidate = 60;

export default async function Home() {
  // Optional: read user cookie for like status
  let currentUserId: string | undefined;
  const cookieStore = await cookies();
  const userPayload = cookieStore.get("tcb_user")?.value;
  if (userPayload) {
    try {
      const user = JSON.parse(atob(userPayload));
      currentUserId = user.uid;
    } catch {}
  }

  // Fetch first page of published generations
  const { data } = await serverDb
    .collection("generations")
    .where({ published: true })
    .field([
      "prompt", "model", "image_url", "reference_image_url",
      "created_at", "user_id", "username", "likes_count",
      "watermark_enabled", "title",
    ])
    .orderBy("created_at", "desc")
    .limit(20)
    .get();

  const { total } = await serverDb
    .collection("generations")
    .where({ published: true })
    .count();

  let items = (data || []).map((item: any) => ({
    ...item,
    user_liked: false,
  }));

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
    }
  }

  return (
    <InspirationGalleryClient
      initialItems={items}
      total={total ?? 0}
      currentUserId={currentUserId}
    />
  );
}
