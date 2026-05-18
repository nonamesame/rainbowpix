import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, url, description } = body;

  if (!name || !email || !url || !description) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const userPayload = request.cookies.get("tcb_user")?.value;
  let userId: string | null = null;
  if (userPayload) {
    try {
      const user = JSON.parse(atob(userPayload));
      userId = user.uid || null;
    } catch {
      // ignore
    }
  }

  const { id } = await serverDb.collection("complaints").add({
    name,
    email,
    url,
    description,
    user_id: userId,
  });

  return NextResponse.json({ id, name, email, url, description }, { status: 201 });
}
