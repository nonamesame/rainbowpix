import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GalleryClient from "@/components/GalleryClient";

export const revalidate = 0;

export default async function GalleryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: items } = await supabase
    .from("generations")
    .select("id, prompt, model, image_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(0, 11);

  const { count } = await supabase
    .from("generations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <GalleryClient
      initialItems={items || []}
      total={count ?? 0}
    />
  );
}
