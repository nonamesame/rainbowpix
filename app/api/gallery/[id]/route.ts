import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userPayload = _request.cookies.get("tcb_user")?.value;
    if (!userPayload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    let user: { uid: string };
    try {
      user = JSON.parse(atob(userPayload));
    } catch {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;

    const { data } = await serverDb
      .collection("generations")
      .where({ _id: id, user_id: user.uid })
      .field(["prompt", "model", "image_url", "reference_image_url", "created_at", "published", "watermark_enabled", "likes_count"])
      .get();

    if (!data || data.length === 0) {
      return Response.json({ error: "未找到" }, { status: 404 });
    }

    return Response.json({ item: data[0] });
  } catch (err: any) {
    console.error("[gallery:get] error:", err?.message || err);
    return Response.json({ error: err?.message || "查询失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userPayload = _request.cookies.get("tcb_user")?.value;
    if (!userPayload) {
      return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    let user: { uid: string };
    try {
      user = JSON.parse(atob(userPayload));
    } catch {
      return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { id } = await params;

    // Clean up associated likes (best-effort, collection may not exist)
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

    await serverDb.collection("generations").doc(id).delete();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[gallery:delete] error:", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "删除失败" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
