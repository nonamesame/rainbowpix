import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Decode base64 user cookie with proper UTF-8 handling. */
export function decodeUserCookie(cookieValue: string) {
  // HMAC 签名格式: base64(json).expiry.signature — 只取第一段（base64 数据部分）
  const dataPart = cookieValue.includes(".") ? cookieValue.split(".")[0] : cookieValue;

  try {
    // New encoding: btoa(encodeURIComponent(json))
    return JSON.parse(decodeURIComponent(atob(dataPart)));
  } catch {
    // Fallback: legacy encoding (btoa with raw UTF-8 bytes)
    const binary = atob(dataPart);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
}
