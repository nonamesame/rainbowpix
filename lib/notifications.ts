import { getUserFromRequest } from "@/lib/auth";
import { NextRequest } from "next/server";

export type NotificationType = "system" | "like" | "comment" | "comment_like" | "announcement";

export interface Notification {
  _id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  image: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Parse user from request cookie (using HMAC-signed cookie verification).
 * @deprecated Use getUserFromRequest() from @/lib/auth directly instead.
 */
export function parseUserFromCookie(request: NextRequest): { uid: string } | null {
  return getUserFromRequest(request);
}
