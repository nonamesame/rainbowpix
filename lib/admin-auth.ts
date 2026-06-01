import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate admin API key from request header.
 * Uses constant-time comparison to prevent timing attacks.
 * Also checks IP whitelist if configured.
 * Returns { valid: true } or { valid: false, response: Response }.
 */
export function checkAdmin(request: NextRequest): { valid: true } | { valid: false; response: Response } {
  // 1. Check IP whitelist (only in Node.js runtime where process.env is available)
  const whitelistRaw = process.env.ADMIN_IP_WHITELIST || "";
  if (whitelistRaw.trim()) {
    const whitelist = whitelistRaw.split(",").map((ip) => ip.trim()).filter(Boolean);
    const clientIp = getAdminIp(request);
    const ipAllowed = whitelist.some((allowed) => clientIp === allowed);
    if (!ipAllowed) {
      return {
        valid: false,
        response: Response.json({ error: "无权访问" }, { status: 403 }),
      };
    }
  }

  // 2. Check admin API key
  const adminKey = request.headers.get("x-admin-key");

  if (!adminKey) {
    return {
      valid: false,
      response: Response.json({ error: "未提供管理员密钥" }, { status: 403 }),
    };
  }

  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey) {
    console.error("[admin-auth] ADMIN_API_KEY 环境变量未配置");
    return {
      valid: false,
      response: Response.json({ error: "服务配置错误" }, { status: 500 }),
    };
  }

  // Reject weak/default keys
  if (expectedKey.length < 16 || expectedKey === "my-own-api") {
    console.error("[admin-auth] ADMIN_API_KEY 强度不足，请更换为16位以上的随机字符串");
    return {
      valid: false,
      response: Response.json({ error: "管理员密钥配置错误" }, { status: 500 }),
    };
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(adminKey, expectedKey)) {
    return {
      valid: false,
      response: Response.json({ error: "管理员密钥无效" }, { status: 403 }),
    };
  }

  return { valid: true };
}

/**
 * Get client IP from request headers.
 */
export function getAdminIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Log admin operation to audit_logs collection.
 */
export async function logAdminAction(
  action: string,
  details: Record<string, any>,
  request?: NextRequest
): Promise<void> {
  try {
    const ip = request ? getAdminIp(request) : "system";
    await serverDb.collection("admin_audit_logs").add({
      action,
      details,
      ip,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    // Don't let audit logging failures break admin operations
    if (!err?.message?.includes("Db or Table not exist")) {
      console.error("[admin-audit] Failed to log:", err);
    }
  }
}
