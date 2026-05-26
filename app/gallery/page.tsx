import { decodeUserCookie } from "@/lib/utils";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { serverDb } from "@/lib/cloudbase/server";
import GalleryClient from "@/components/GalleryClient";

export const revalidate = 0;

export default async function GalleryPage() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("tcb_user")?.value;

  if (!userCookie) {
    redirect("/login");
  }

  let user: { uid: string; email?: string };
  try {
    user = decodeUserCookie(userCookie);
  } catch {
    redirect("/login");
  }

  const { data: items } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid })
    .field(["prompt", "model", "image_url", "reference_image_url", "created_at", "published", "watermark_enabled", "likes_count"])
    .orderBy("created_at", "desc")
    .skip(0)
    .limit(12)
    .get();

  return (
    <GalleryClient
      initialItems={items || []}
      total={(items?.length ?? 0) >= 12 ? -1 : (items?.length ?? 0)}
      user={user}
    />
  );
}
