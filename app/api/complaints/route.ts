import { getUserFromRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, url, description } = body;

  if (!name || !email || !url || !description) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const authUser = getUserFromRequest(request);
  let userId: string | null = authUser?.uid || null;

  const { id } = await serverDb.collection("complaints").add({
    name,
    email,
    url,
    description,
    user_id: userId,
  });

  return NextResponse.json({ id, name, email, url, description }, { status: 201 });
}
