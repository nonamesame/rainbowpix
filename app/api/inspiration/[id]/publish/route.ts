import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { parseUserFromCookie } from "@/lib/notifications";
import { getDisplayName } from "@/lib/inspiration";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = parseUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id: generationId } = await params;
  const body = await request.json();
  const { published, watermark_enabled, title } = body;

  // Verify ownership
  const { data } = await serverDb
    .collection("generations")
    .where({ _id: generationId, user_id: user.uid })
    .get();

  if (!data || data.length === 0) {
    return Response.json({ error: "未找到" }, { status: 404 });
  }

  const updateFields: Record<string, any> = {
    published: !!published,
  };

  if (published) {
    // When publishing, set username and watermark setting
    updateFields.username = getDisplayName(user);
    if (typeof watermark_enabled === "boolean") {
      updateFields.watermark_enabled = watermark_enabled;
    }
    if (typeof title === "string" && title.trim()) {
      updateFields.title = title.trim();
    }
  }

  await serverDb.collection("generations").doc(generationId).update(updateFields);

  return Response.json({
    published: !!published,
    watermark_enabled: published ? !!watermark_enabled : data[0].watermark_enabled,
  });
}
