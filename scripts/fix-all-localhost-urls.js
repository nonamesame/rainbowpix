/**
 * 全面扫描并修复所有集合中的 localhost/placeholder 绝对 URL
 * 覆盖: notifications, generations, users 等可能存储图片 URL 的集合
 *
 * 用法: node scripts/fix-all-localhost-urls.js [--dry-run]
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

// 匹配任意域名的绝对 URL 指向 /api/images/ 或 /api/admin/upload
const ABSOLUTE_URL_RE = /https?:\/\/[^/]+(\/api\/(?:images|admin\/upload)\/[^)\s"'<>]+)/g;

/**
 * 扫描指定集合，找出包含绝对 URL 的字段
 */
async function scanCollection(collectionName, fields, where = {}) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`扫描集合: ${collectionName}`);
  console.log(`${"=".repeat(50)}`);

  let allItems = [];
  let offset = 0;
  const limit = 100;

  while (offset < 2000) {
    const query = db.collection(collectionName);
    const filtered = Object.keys(where).length > 0 ? query.where(where) : query;
    const res = await filtered.skip(offset).limit(limit).get();
    const items = res.data || [];
    allItems.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }

  console.log(`共 ${allItems.length} 条记录`);

  let issueCount = 0;
  const fixes = [];

  for (const doc of allItems) {
    for (const field of fields) {
      const value = doc[field];
      if (typeof value !== "string") continue;

      const matches = value.match(ABSOLUTE_URL_RE);
      if (matches && matches.length > 0) {
        issueCount++;
        console.log(`\n  [${doc._id}] 字段 "${field}" 发现 ${matches.length} 个绝对 URL:`);
        matches.forEach((m) => console.log(`    ${m}`));
        fixes.push({ doc, field, value, matches });
      }
    }
  }

  console.log(`\n  问题记录数: ${issueCount}`);
  return fixes;
}

/**
 * 修复一条记录的指定字段
 */
function fixAbsoluteUrls(value) {
  return value.replace(ABSOLUTE_URL_RE, "$1");
}

/**
 * 对匹配到的 fixes 执行更新
 */
async function applyFixes(collectionName, fixes) {
  if (fixes.length === 0) return 0;

  let fixed = 0;
  for (const { doc, field, value } of fixes) {
    const newValue = fixAbsoluteUrls(value);
    if (newValue === value) continue;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] ${collectionName}/${doc._id}.${field} 将被修复`);
    } else {
      await db.collection(collectionName).doc(doc._id).update({ [field]: newValue });
      console.log(`  ✓ ${collectionName}/${doc._id}.${field}`);
    }
    fixed++;
  }
  return fixed;
}

async function main() {
  console.log("=== 全面修复 localhost/placeholder 绝对 URL ===");
  if (DRY_RUN) console.log("(DRY RUN 模式，不会实际修改)\n");

  let totalFixed = 0;

  // 1. notifications (公告/通知) - body 和 image 字段
  const notifFixes = await scanCollection("notifications", ["body", "image"]);
  totalFixed += await applyFixes("notifications", notifFixes);

  // 2. generations (灵感/AI生成) - image_url, reference_image_url, prompt(可能嵌入图片)
  const genFixes = await scanCollection("generations", ["image_url", "reference_image_url"]);
  totalFixed += await applyFixes("generations", genFixes);

  // 3. users (用户头像)
  const userFixes = await scanCollection("users", ["avatar_url", "avatar"]);
  totalFixed += await applyFixes("users", userFixes);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`全部完成，共修复 ${totalFixed} 条记录`);
  console.log(`${"=".repeat(50)}`);
}

main().catch(console.error);
