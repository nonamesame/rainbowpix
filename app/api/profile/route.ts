import { NextRequest } from "next/server";
import { serverDb } from "@/lib/cloudbase/server";

// Check if error is "collection not exist"
function isCollectionNotExist(error: unknown): boolean {
  const msg = String(error);
  return msg.includes("Db or Table not exist") || msg.includes("not exist");
}

async function safeGetCollection(collection: string) {
  try {
    return await serverDb.collection(collection).limit(1).get();
  } catch (error) {
    if (isCollectionNotExist(error)) {
      return { data: [] };
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let user: { uid: string; username?: string; email?: string; phone?: string };
  try {
    user = JSON.parse(atob(userPayload));
  } catch {
    return Response.json({ error: "登录信息无效" }, { status: 401 });
  }

  try {
    // Try to get profile from users collection
    let profile: any = null;
    let collectionExists = true;

    try {
      const { data } = await serverDb
        .collection("users")
        .where({ uid: user.uid })
        .limit(1)
        .get();
      profile = data?.[0];
    } catch (error) {
      if (isCollectionNotExist(error)) {
        collectionExists = false;
      } else {
        throw error;
      }
    }

    // Auto-create record for users (if collection exists)
    if (collectionExists && !profile) {
      const newRecord = {
        uid: user.uid,
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
        bio: "",
        created_at: new Date().toISOString(),
      };
      try {
        await serverDb.collection("users").add(newRecord);
        profile = newRecord;
      } catch {
        // Collection might not exist, ignore
      }
    }

    // Return profile data (from DB or cookie fallback)
    return Response.json({
      uid: user.uid,
      username: profile?.username || user.username || "",
      email: profile?.email || user.email || "",
      phone: profile?.phone || user.phone || "",
      bio: profile?.bio || "",
      created_at: profile?.created_at || "",
    });
  } catch (error) {
    // Fallback: return cookie data
    return Response.json({
      uid: user.uid,
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      bio: "",
      created_at: "",
    });
  }
}

export async function PATCH(request: NextRequest) {
  const userPayload = request.cookies.get("tcb_user")?.value;
  if (!userPayload) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let user: { uid: string; username?: string; email?: string; phone?: string };
  try {
    user = JSON.parse(atob(userPayload));
  } catch {
    return Response.json({ error: "登录信息无效" }, { status: 401 });
  }

  const body = await request.json();
  const { username, bio } = body;

  // Validate username if provided
  if (username !== undefined) {
    if (!/^[a-z][0-9a-z_-]{5,24}$/.test(username)) {
      return Response.json(
        { error: "用户名格式不正确，需以小写字母开头，6-25位字母数字下划线连字符" },
        { status: 400 }
      );
    }
  }

  try {
    // Try to find and update/create user record
    let profile: any = null;
    let collectionExists = true;

    try {
      const { data } = await serverDb
        .collection("users")
        .where({ uid: user.uid })
        .limit(1)
        .get();
      profile = data?.[0];
    } catch (error) {
      if (isCollectionNotExist(error)) {
        collectionExists = false;
      } else {
        throw error;
      }
    }

    if (collectionExists) {
      const updates: Record<string, unknown> = {};
      if (username !== undefined) updates.username = username;
      if (bio !== undefined) updates.bio = bio;

      if (profile) {
        await serverDb
          .collection("users")
          .doc(profile._id)
          .update(updates);
      } else {
        await serverDb.collection("users").add({
          uid: user.uid,
          username: username || user.username || "",
          email: user.email || "",
          phone: user.phone || "",
          bio: bio || "",
          created_at: new Date().toISOString(),
        });
      }
    }

    // Sync username to all generations if changed
    if (username !== undefined && username !== user.username) {
      try {
        const { data: generations } = await serverDb
          .collection("generations")
          .where({ user_id: user.uid })
          .field(["_id"])
          .get();

        if (generations && generations.length > 0) {
          for (const gen of generations) {
            await serverDb
              .collection("generations")
              .doc(gen._id)
              .update({ username });
          }
        }
      } catch {
        // Ignore sync errors
      }
    }

    // Build updated cookie payload
    const updatedUser = {
      uid: user.uid,
      username: username !== undefined ? username : user.username,
      email: user.email,
      phone: user.phone,
    };

    const cookiePayload = Buffer.from(JSON.stringify(updatedUser)).toString("base64");

    return Response.json({
      success: true,
      user: updatedUser,
      cookie: cookiePayload,
    });
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return Response.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  }
}
