import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Decode base64 user cookie with proper UTF-8 handling. */
export function decodeUserCookie(base64: string) {
  try {
    // New encoding: btoa(encodeURIComponent(json))
    return JSON.parse(decodeURIComponent(atob(base64)));
  } catch {
    // Fallback: legacy encoding (btoa with raw UTF-8 bytes)
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
}
