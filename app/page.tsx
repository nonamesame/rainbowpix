import InspirationGalleryClient from "@/components/InspirationGalleryClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Pass empty initial data — client component fetches from CloudBase directly
  // This avoids serverless function timeout on EdgeOne Pages
  return (
    <InspirationGalleryClient
      initialItems={[]}
      total={0}
      currentUserId={undefined}
    />
  );
}
