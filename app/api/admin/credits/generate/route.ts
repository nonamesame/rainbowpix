import { NextRequest } from "next/server";
import { generateKeys } from "@/lib/credits";

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  const body = await request.json();
  const { count, credits_per_key } = body;

  if (!count || typeof count !== "number" || count < 1 || count > 100) {
    return Response.json({ error: "数量必须在 1-100 之间" }, { status: 400 });
  }

  const creditsPerKey =
    typeof credits_per_key === "number" && credits_per_key > 0
      ? Math.floor(credits_per_key)
      : 1;

  const keys = await generateKeys(count, creditsPerKey, "admin");

  return Response.json({
    success: true,
    count: keys.length,
    credits_per_key: creditsPerKey,
    keys: keys.map((k) => k.key),
  }, { status: 201 });
}
