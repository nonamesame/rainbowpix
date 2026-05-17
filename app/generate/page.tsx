import { createClient } from "@/lib/supabase/server";
import GeneratePageClient from "@/components/GeneratePageClient";

export const revalidate = 60;

export default async function GeneratePage() {
  const supabase = await createClient();

  const { data: examples } = await supabase
    .from("examples")
    .select("*")
    .or("is_public.eq.true,is_builtin.eq.true")
    .order("created_at", { ascending: false })
    .limit(20);

  return <GeneratePageClient examples={examples || []} />;
}
