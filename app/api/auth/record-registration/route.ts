import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  try {
    // 检查是否已记录过
    const { total } = await serverDb
      .collection("users")
      .where({ uid: user.uid })
      .count();

    if (total && total > 0) {
      return Response.json({ success: true, existed: true });
    }

    // 首次注册，写入记录
    await serverDb.collection("users").add({
      uid: user.uid,
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      created_at: new Date().toISOString(),
    });

    return Response.json({ success: true, existed: false });
  } catch (error) {
    console.error("Record registration error:", error);
    return Response.json({ error: "记录注册信息失败" }, { status: 500 });
  }
}
