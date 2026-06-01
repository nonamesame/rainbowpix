import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  const body = await request.json();
  const { image_url, prompt, negative_prompt, model, width, height, category } = body;

  if (!image_url || !prompt || !model) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const { id } = await serverDb.collection("examples").add({
    image_url,
    prompt,
    negative_prompt: negative_prompt || null,
    model,
    width: width || 1024,
    height: height || 1024,
    category: category || null,
    is_builtin: true,
    is_public: true,
    author_id: null,
    created_at: new Date().toISOString(),
  });

  await logAdminAction("create_example", { title: prompt.slice(0, 100) }, request);

  return NextResponse.json({ id, image_url, prompt, model }, { status: 201 });
}
