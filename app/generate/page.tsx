import { Suspense } from "react";
import { serverDb } from "@/lib/cloudbase/server";
import GeneratePageClient from "@/components/GeneratePageClient";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GeneratePage({ searchParams }: Props) {
  const params = await searchParams;
  const { data: examples } = await serverDb
    .collection("examples")
    .where({
      $or: [{ is_public: true }, { is_builtin: true }],
    })
    .orderBy("created_at", "desc")
    .limit(20)
    .get();

  const promptParam = typeof params.prompt === "string" ? params.prompt : "";
  const modelParam = typeof params.model === "string" ? params.model : "";
  const refParam = typeof params.ref === "string" ? params.ref : "";
  const ratioParam = typeof params.ratio === "string" ? params.ratio : "";

  return (
    <Suspense>
      <GeneratePageClient
        examples={examples || []}
        initialPrompt={promptParam}
        initialModel={modelParam}
        initialRef={refParam}
        initialRatio={ratioParam}
      />
    </Suspense>
  );
}
