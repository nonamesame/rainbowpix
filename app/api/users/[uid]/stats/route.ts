import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  try {
    // Get published works count
    const { total: publishedCount } = await serverDb
      .collection("generations")
      .where({ user_id: uid, published: true })
      .count();

    // Get total likes across all published works
    const { data: works } = await serverDb
      .collection("generations")
      .where({ user_id: uid, published: true })
      .field(["likes_count"])
      .get();

    const totalLikes = (works || []).reduce(
      (sum: number, w: any) => sum + (w.likes_count || 0),
      0
    );

    // Get latest username and avatar from users collection
    let username = "";
    let avatar_url = "";
    try {
      const { data: users } = await serverDb
        .collection("users")
        .where({ uid })
        .field(["username", "avatar_url"])
        .limit(1)
        .get();
      if (users && users.length > 0) {
        username = users[0].username || "";
        avatar_url = users[0].avatar_url || "";
      }
    } catch {
      // users collection may not exist
    }

    // Fallback: get username from generations if users collection has no record
    if (!username) {
      try {
        const { data: gens } = await serverDb
          .collection("generations")
          .where({ user_id: uid })
          .field(["username"])
          .limit(1)
          .get();
        if (gens && gens.length > 0) {
          username = gens[0].username || "";
        }
      } catch {}
    }

    return Response.json({
      published_count: publishedCount ?? 0,
      total_likes: totalLikes,
      username,
      avatar_url,
    });
  } catch (error) {
    console.error("User stats error:", error);
    return Response.json({ published_count: 0, total_likes: 0, username: "", avatar_url: "" });
  }
}
