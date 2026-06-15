import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");

  if (!username || username.length < 6 || username.length > 25) {
    return Response.json({ available: false, error: "用户名长度需为6-25位" });
  }

  if (!/^[a-z][0-9a-z_-]{5,24}$/.test(username)) {
    return Response.json({ available: false, error: "以小写字母开头，仅支持小写字母、数字、下划线和横杠" });
  }

  try {
    const { total } = await serverDb
      .collection("users")
      .where({ username })
      .count();

    return Response.json({ available: total === 0 });
  } catch (error) {
    return Response.json({ available: false, error: "检查失败，请稍后重试" });
  }
}
