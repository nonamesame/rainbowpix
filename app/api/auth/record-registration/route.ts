import { decodeUserCookie } from "@/lib/utils";
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function POST(request: NextRequest) {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let user: { uid: string; username?: string; email?: string; phone?: string };
  try {
    user = decodeUserCookie(userPayload);
  } catch {
    return Response.json({ error: "登录信息无效" }, { status: 401 });
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
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
