import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function DELETE(request: NextRequest) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "缺少 id 参数" }, { status: 400 });
  }

  try {
    // Verify the record belongs to admin
    const { data } = await serverDb
      .collection("generations")
      .doc(id)
      .get();

    if (!data || data.user_id !== "admin") {
      return Response.json({ error: "无权删除此记录" }, { status: 403 });
    }

    await serverDb.collection("generations").doc(id).remove();

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete admin inspiration error:", error);
    return Response.json({ error: "删除失败" }, { status: 500 });
  }
}
