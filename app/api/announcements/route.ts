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

    console.log("[announcements] 查询到", result.data?.length, "条公告");

    const announcements = (result.data || []).map((a: any) => {
      // 提取 body 中的图片 URL 用于日志
      const imageUrls = (a.body || "").match(/!\[[^\]]*\]\(([^)]+)\)/g) || [];

      console.log("[announcements] 公告:", a._id);
      console.log("[announcements]   title:", a.title);
      console.log("[announcements]   image 字段:", a.image || "(空)");
      console.log("[announcements]   body 长度:", (a.body || "").length);
      console.log("[announcements]   body 中图片数量:", imageUrls.length);
      if (imageUrls.length > 0) {
        // 提取并打印每个图片 URL
        const urlRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
        let m;
        while ((m = urlRegex.exec(a.body || "")) !== null) {
          console.log("[announcements]   body 图片 URL:", m[1]);
        }
      }

      return {
        _id: a._id,
        title: a.title,
        body: a.body,
        image: a.image || null,
        created_at: a.created_at,
      };
    });

    return Response.json(announcements);
  } catch (error) {
    console.error("Fetch announcements error:", error);
    return Response.json({ error: "获取公告失败" }, { status: 500 });
  }
}
