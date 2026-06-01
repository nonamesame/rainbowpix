import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getBalance } from "@/lib/credits";

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const balance = await getBalance(user.uid);
  return Response.json(balance);
}
