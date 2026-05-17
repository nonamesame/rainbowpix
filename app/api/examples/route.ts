import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const category = searchParams.get("category");
  const limit = Number(searchParams.get("limit")) || 20;
  const offset = Number(searchParams.get("offset")) || 0;

  let query = supabase
    .from("examples")
    .select("*")
    .or("is_public.eq.true,is_builtin.eq.true")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const { image_url, prompt, negative_prompt, model, width, height } = body;

  if (!image_url || !prompt || !model) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("examples")
    .insert({
      image_url,
      prompt,
      negative_prompt: negative_prompt || null,
      model,
      width: width || 1024,
      height: height || 1024,
      is_builtin: false,
      is_public: true,
      author_id: user.id,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
