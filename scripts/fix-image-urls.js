/**
 * 一次性迁移脚本：修复数据库中使用绝对 URL 的图片链接
 * 将 http://localhost:3000/api/images/... 和 https://placeholder.example.com/api/images/...
 * 统一改为 /api/images/...
 *
 * 用法: node scripts/fix-image-urls.js
 */

const tcb = require("@cloudbase/node-sdk");

const env = process.env.TCB_ENV_ID || process.env.NEXT_PUBLIC_TCB_ENV_ID;
if (!env) {
  console.error("Error: TCB_ENV_ID or NEXT_PUBLIC_TCB_ENV_ID is not set");
  process.exit(1);
}

const app = tcb.init({
  env,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY,
});

const db = app.database();

// Match any absolute URL prefix before /api/images/
const ABS_URL_RE = /^https?:\/\/[^/]+\/api\/images\//;

async function fixCollection(collectionName, fields) {
  console.log(`\nProcessing collection: ${collectionName}`);

  let totalFixed = 0;
  const PAGE_SIZE = 100;
  let skip = 0;

  while (true) {
    try {
      const { data } = await db
        .collection(collectionName)
        .skip(skip)
        .limit(PAGE_SIZE)
        .get();

      if (!data || data.length === 0) break;

      for (const doc of data) {
        const updates = {};
        let needsUpdate = false;

        for (const field of fields) {
          const value = doc[field];
          if (typeof value === "string" && ABS_URL_RE.test(value)) {
            // Strip the origin: "http://localhost:3000/api/images/xxx" -> "/api/images/xxx"
            updates[field] = value.replace(ABS_URL_RE, "/api/images/");
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await db.collection(collectionName).doc(doc._id).update(updates);
          totalFixed++;
          console.log(`  Fixed: ${doc._id}`);
        }
      }

      skip += data.length;
      if (data.length < PAGE_SIZE) break;
    } catch (err) {
      if (err.message?.includes("Db or Table not exist") || err.message?.includes("not exist")) {
        console.log(`  Collection ${collectionName} does not exist, skipping.`);
        return 0;
      }
      throw err;
    }
  }

  console.log(`  Total fixed in ${collectionName}: ${totalFixed}`);
  return totalFixed;
}

async function main() {
  console.log("=== Fix Image URLs Migration ===");
  console.log("Converting absolute URLs to relative /api/images/ paths\n");

  let total = 0;

  total += await fixCollection("users", ["avatar_url"]);
  total += await fixCollection("generations", ["image_url", "reference_image_url"]);
  total += await fixCollection("gallery_comments", ["avatar_url"]);
  total += await fixCollection("notifications", ["image"]);

  console.log(`\n=== Migration complete. Total records fixed: ${total} ===`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
