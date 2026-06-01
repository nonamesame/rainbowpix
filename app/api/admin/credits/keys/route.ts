import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";
import { checkAdmin, logAdminAction } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 50;
  const filter = searchParams.get("filter"); // "used" | "unused" | null (all)

  const where: Record<string, any> = {};
  if (filter === "used") where.used = true;
  if (filter === "unused") where.used = false;

  try {
    const { data, total } = await serverDb
      .collection("credit_keys")
      .where(where)
      .orderBy("created_at", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return Response.json({
      items: (data || []).map((d: any) => ({
        _id: d._id,
        key: d.key,
        credits: d.credits,
        used: d.used,
        used_by: d.used_by,
        used_at: d.used_at,
        created_at: d.created_at,
      })),
      total: total ?? 0,
      page,
      hasMore: page * pageSize < (total ?? 0),
    });
  } catch (err: any) {
    // 集合不存在时返回空列表
    if (err?.message?.includes("Db or Table not exist")) {
      return Response.json({ items: [], total: 0, page: 1, hasMore: false });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest) {
  const adminCheck = checkAdmin(request);
  if (!adminCheck.valid) return adminCheck.response;

  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "缺少密钥 ID 列表" }, { status: 400 });
  }

  if (ids.length > 100) {
    return Response.json({ error: "单次最多删除 100 条" }, { status: 400 });
  }

  let deleted = 0;
  for (const id of ids) {
    try {
      // 仅删除未使用的密钥
      const { data } = await serverDb
        .collection("credit_keys")
        .doc(id)
        .get();

      if (data && !data.used) {
        await serverDb.collection("credit_keys").doc(id).delete();
        deleted++;
      }
    } catch {
      // 跳过不存在的文档
    }
  }

  await logAdminAction("delete_keys", { ids }, request);

  return Response.json({ success: true, deleted });
}
