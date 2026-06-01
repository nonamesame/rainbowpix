import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { redeemKey } from "@/lib/credits";

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const body = await request.json();
  const { key } = body;

  if (!key || typeof key !== "string") {
    return Response.json({ error: "请输入密钥" }, { status: 400 });
  }

  // 校验密钥格式：64位十六进制字符串
  if (!/^[0-9a-f]{64}$/i.test(key.trim())) {
    return Response.json({ error: "密钥格式无效" }, { status: 400 });
  }

  const result = await redeemKey(user.uid, key.trim());

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({
    success: true,
    balance: result.balance,
    credits_added: result.credits_added,
  });
}
