/**
 * 修复 notifications 集合中 body 里的 http://localhost:3000 绝对 URL
 * 转换为相对路径 /api/images/...
 *
 * 用法: node scripts/fix-localhost-image-urls.js [--dry-run]
 */

const tcb = require("@cloudbase/node-sdk");

const DRY_RUN = process.argv.includes("--dry-run");

const app = tcb.init({
  env: process.env.TCB_ENV_ID || "rainbowpix-prod-d6fdzwh43bd494af",
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY,
});

if (!process.env.TCB_SECRET_ID || !process.env.TCB_SECRET_KEY) {
  console.error("请设置环境变量 TCB_SECRET_ID 和 TCB_SECRET_KEY");
  process.exit(1);
}

const db = app.database();

// 匹配 http://localhost:3000/api/images/... 和 http://placeholder.example.com/api/images/...
const LOCALHOST_RE = /https?:\/\/localhost:\d+(\/api\/images\/[^)\s]+)/g;
const PLACEHOLDER_RE = /https?:\/\/placeholder\.example\.com(\/api\/images\/[^)\s]+)/g;

async function main() {
  console.log("=== 修复 localhost 图片 URL ===");
  if (DRY_RUN) console.log("(DRY RUN 模式，不会实际修改)\n");

  // 获取所有包含 localhost URL 的公告
  const result = await db
    .collection("notifications")
    .where({ type: "announcement" })
    .limit(100)
    .get();

  console.log(`共 ${result.data.length} 条公告`);

  let fixed = 0;

  for (const doc of result.data) {
    const body = doc.body || "";
    let newBody = body;
    let changed = false;

    // 替换 localhost URL
    const localhostMatches = body.match(LOCALHOST_RE);
    if (localhostMatches) {
      newBody = newBody.replace(LOCALHOST_RE, "$1");
      changed = true;
      console.log(`[${doc._id}] 发现 ${localhostMatches.length} 个 localhost URL`);
      localhostMatches.forEach((m) => console.log(`  ${m}`));
    }

    // 替换 placeholder URL
    const placeholderMatches = body.match(PLACEHOLDER_RE);
    if (placeholderMatches) {
      newBody = newBody.replace(PLACEHOLDER_RE, "$1");
      changed = true;
      console.log(`[${doc._id}] 发现 ${placeholderMatches.length} 个 placeholder URL`);
      placeholderMatches.forEach((m) => console.log(`  ${m}`));
    }

    if (changed) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] 将修复 body`);
      } else {
        await db.collection("notifications").doc(doc._id).update({ body: newBody });
        console.log(`  ✓ 已修复`);
      }
      fixed++;
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`修复了 ${fixed} 条公告`);
}

main().catch(console.error);
