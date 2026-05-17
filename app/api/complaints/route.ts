import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { name, email, url, description } = body;

  if (!name || !email || !url || !description) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("complaints")
    .insert({
      name,
      email,
      url,
      description,
      user_id: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
