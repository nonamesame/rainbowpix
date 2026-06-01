import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

export async function DELETE(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "缺少 id 参数" }, { status: 400 });
  }

  try {
    // Clean up associated likes
    try {
      const { data: likes } = await serverDb
        .collection("gallery_likes")
        .where({ generation_id: id })
        .get();
      if (likes) {
        for (const like of likes) {
          await serverDb.collection("gallery_likes").doc(like._id).delete();
        }
      }
    } catch {
      // gallery_likes collection may not exist yet
    }

    await serverDb.collection("generations").doc(id).remove();
    await logAdminAction("delete_inspiration", { id }, request);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete admin inspiration error:", error);
    return Response.json({ error: "删除失败" }, { status: 500 });
  }
}
