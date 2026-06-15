import { NextRequest } from "next/server";
import CryptoJS from "crypto-js";

const AUTH_SECRET = process.env.AUTH_SECRET || "";
const COOKIE_MAX_AGE = 86400; // 24 hours in seconds

interface UserPayload {
  uid: string;
  email?: string;
  phone?: string;
  username?: string;
  avatar_url?: string;
}

interface SignedPayload {
  data: UserPayload;
  exp: number; // expiry timestamp (seconds)
  sig: string; // HMAC-SHA256 signature
}

/**
 * Sign a user payload into a tamper-proof cookie value.
 * Format: base64(data).expiry.hmac_signature
 */
export function signUserPayload(payload: UserPayload): string {
  if (!AUTH_SECRET) {
    throw new Error("AUTH_SECRET 环境变量未配置");
  }
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE;
  const dataStr = btoa(encodeURIComponent(JSON.stringify(payload)));
  const expStr = String(exp);
  const sig = CryptoJS.HmacSHA256(dataStr + "." + expStr, AUTH_SECRET).toString();
  return `${dataStr}.${expStr}.${sig}`;
}

/**
 * Verify and decode a signed cookie value.
 * Returns the user payload if valid, null if expired/tampered.
 */
export function verifyUserCookie(signedCookie: string): UserPayload | null {
  if (!AUTH_SECRET) {
    console.error("[auth] AUTH_SECRET 环境变量未配置");
    return null;
  }

  const parts = signedCookie.split(".");
  if (parts.length !== 3) return null;

  const [dataStr, expStr, sig] = parts;

  // Verify signature
  const expectedSig = CryptoJS.HmacSHA256(dataStr + "." + expStr, AUTH_SECRET).toString();
  if (sig !== expectedSig) {
    console.warn("[auth] Cookie 签名验证失败（可能被篡改）");
    return null;
  }

  // Check expiry
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Math.floor(Date.now() / 1000) > exp) {
    return null; // expired
  }

  // Decode payload
  try {
    const payload: UserPayload = JSON.parse(decodeURIComponent(atob(dataStr)));
    if (!payload.uid) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify user from a NextRequest's tcb_user cookie.
 * Returns the user payload if valid, null otherwise.
 * This is the unified auth check for all API routes.
 * Falls back to legacy unsigned cookie for backward compatibility.
 */
export function getUserFromRequest(request: NextRequest): UserPayload | null {
  const cookieValue = request.cookies.get("tcb_user")?.value;
  if (!cookieValue) return null;
  // Try signed cookie first
  const signed = verifyUserCookie(cookieValue);
  if (signed) return signed;
  // Fallback: legacy unsigned base64 cookie
  return decodeLegacyCookie(cookieValue);
}

/**
 * Legacy: decode an unsigned base64 cookie (for backward compatibility).
 * @deprecated Use getUserFromRequest() instead.
 */
export function decodeLegacyCookie(base64: string): UserPayload | null {
  try {
    return JSON.parse(decodeURIComponent(atob(base64)));
  } catch {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }
}
