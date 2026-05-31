import { cookies } from "next/headers";
import { decodeUserCookie } from "@/lib/utils";
import InspirationGalleryClient from "@/components/InspirationGalleryClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  let currentUserId: string | undefined;
  try {
    const cookieStore = await cookies();
    const userPayload = cookieStore.get("tcb_user")?.value;
    if (userPayload) {
      currentUserId = decodeUserCookie(userPayload).uid;
    }
  } catch {}

  // Pass empty initial data — client component fetches from CloudBase directly
  // This avoids serverless function timeout on EdgeOne Pages
  return (
    <InspirationGalleryClient
      initialItems={[]}
      total={0}
      currentUserId={currentUserId}
    />
  );
}
