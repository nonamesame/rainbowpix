import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("examples")
    .insert({
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
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
