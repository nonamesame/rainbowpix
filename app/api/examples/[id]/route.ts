import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;

  const { data: example, error: fetchError } = await supabase
    .from("examples")
    .select("author_id")
    .eq("id", id)
    .single();

  if (fetchError || !example) {
    return NextResponse.json({ error: "示例不存在" }, { status: 404 });
  }

  if (example.author_id !== user.id) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("examples")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
