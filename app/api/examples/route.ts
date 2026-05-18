import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const category = searchParams.get("category");
  const limit = Number(searchParams.get("limit")) || 20;
  const offset = Number(searchParams.get("offset")) || 0;

  const where: Record<string, unknown> = {
    $or: [{ is_public: true }, { is_builtin: true }],
  };

  if (category) {
    where.category = category;
  }

  const { data } = await serverDb
    .collection("examples")
    .where(where)
    .orderBy("created_at", "desc")
    .skip(offset)
    .limit(limit)
    .get();

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let user: { uid: string };
  try {
    user = JSON.parse(atob(userPayload));
  } catch {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const { image_url, prompt, negative_prompt, model, width, height } = body;

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
    is_builtin: false,
    is_public: true,
    author_id: user.uid,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ id, image_url, prompt, model }, { status: 201 });
}
