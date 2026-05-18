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
    user = JSON.parse(atob(userCookie));
  } catch {
    redirect("/login");
  }

  const { data: items } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid })
    .field(["id", "prompt", "model", "image_url", "created_at"])
    .orderBy("created_at", "desc")
    .skip(0)
    .limit(12)
    .get();

  const { total } = await serverDb
    .collection("generations")
    .where({ user_id: user.uid })
    .count();

  return (
    <GalleryClient
      initialItems={items || []}
      total={total ?? 0}
    />
  );
}
