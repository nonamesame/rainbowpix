import { decodeUserCookie } from "@/lib/utils";
import { NextRequest } from "next/server";

export type NotificationType = "system" | "like" | "comment" | "announcement";

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

export function parseUserFromCookie(request: NextRequest): { uid: string } | null {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) return null;
  try {
    return decodeUserCookie(userPayload);
  } catch {
    return null;
  }
}
