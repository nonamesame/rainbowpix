import { NextRequest } from "next/server";
import { decodeUserCookie } from "@/lib/utils";
import { getBalance } from "@/lib/credits";

export async function GET(request: NextRequest) {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let user: { uid: string };
  try {
    user = decodeUserCookie(userPayload);
  } catch {
    return Response.json({ error: "登录信息无效" }, { status: 401 });
  }

  const balance = await getBalance(user.uid);
  return Response.json(balance);
}
