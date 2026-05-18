import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get("x-admin-key");

  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

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

  return NextResponse.json({ id, image_url, prompt, model }, { status: 201 });
}
