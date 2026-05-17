import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";

export const revalidate = 60;

export default async function Home() {
  const supabase = await createClient();

  const { data: featuredExamples } = await supabase
    .from("examples")
    .select("*")
    .or("is_public.eq.true,is_builtin.eq.true")
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: latestExamples } = await supabase
    .from("examples")
    .select("*")
    .or("is_public.eq.true,is_builtin.eq.true")
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <DashboardClient
      featuredExamples={featuredExamples || []}
      latestExamples={latestExamples || []}
    />
  );
}
