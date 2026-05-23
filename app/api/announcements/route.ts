import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  try {
    const result = await serverDb
      .collection("notifications")
      .where({ type: "announcement" })
      .orderBy("created_at", "desc")
      .limit(20)
      .get();

    const announcements = (result.data || []).map((a) => ({
      _id: a._id,
      title: a.title,
      body: a.body,
      image: a.image || null,
      created_at: a.created_at,
    }));

    return Response.json(announcements);
  } catch (error) {
    console.error("Fetch announcements error:", error);
    return Response.json({ error: "获取公告失败" }, { status: 500 });
  }
}
