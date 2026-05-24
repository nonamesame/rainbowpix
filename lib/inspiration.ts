export interface InspirationItem {
  _id: string;
  user_id: string;
  prompt: string;
  model: string;
  image_url: string;
  reference_image_url?: string;
  created_at: string;
  published: boolean;
  watermark_enabled: boolean;
  likes_count: number;
  username: string;
  title?: string;
  user_liked?: boolean;
  width?: number;
  height?: number;
}

export interface GalleryLike {
  _id: string;
  user_id: string;
  generation_id: string;
  created_at: string;
}

export function getDisplayName(user: { uid: string; email?: string; phone?: string; username?: string }): string {
  if (user.username) {
    return user.username;
  }
  if (user.email) {
    return user.email.split("@")[0];
  }
  if (user.phone) {
    return user.phone;
  }
  return "用户";
}
