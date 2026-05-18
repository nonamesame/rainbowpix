import { serverDb } from "@/lib/cloudbase/server";
import DashboardClient from "@/components/DashboardClient";

export const revalidate = 60;

export default async function Home() {
  const publicQuery = {
    $or: [{ is_public: true }, { is_builtin: true }],
  };

  const { data: featuredExamples } = await serverDb
    .collection("examples")
    .where(publicQuery)
    .orderBy("created_at", "desc")
    .limit(8)
    .get();

  const { data: latestExamples } = await serverDb
    .collection("examples")
    .where(publicQuery)
    .orderBy("created_at", "desc")
    .limit(12)
    .get();

  return (
    <DashboardClient
      featuredExamples={featuredExamples || []}
      latestExamples={latestExamples || []}
    />
  );
}
