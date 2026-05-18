import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userPayload = _request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let user: { uid: string };
  try {
    user = JSON.parse(atob(userPayload));
  } catch {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;

  const { data: examples } = await serverDb
    .collection("examples")
    .where({ id })
    .limit(1)
    .get();

  if (!examples || examples.length === 0) {
    return NextResponse.json({ error: "示例不存在" }, { status: 404 });
  }

  const example = examples[0];

  if (example.author_id !== user.uid) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  await serverDb.collection("examples").doc(example._id).delete();

  return NextResponse.json({ success: true });
}
