import { NextRequest } from "next/server";
import { generateKeys } from "@/lib/credits";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

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

  await logAdminAction("generate_keys", { count, creditsPerKey }, request);

  return Response.json({
    success: true,
    count: keys.length,
    credits_per_key: creditsPerKey,
    keys: keys.map((k) => k.key),
  }, { status: 201 });
}
