import { serverDb } from "@/lib/cloudbase/server";
import GeneratePageClient from "@/components/GeneratePageClient";

export default async function GeneratePage() {
  const { data: examples } = await serverDb
    .collection("examples")
    .where({
      $or: [{ is_public: true }, { is_builtin: true }],
    })
    .orderBy("created_at", "desc")
    .limit(20)
    .get();

  return <GeneratePageClient examples={examples || []} />;
}
