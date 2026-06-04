/**
 * 迁移脚本：将 generations 集合中的外部图片 URL 上传到 CloudBase
 * - 找到所有 image_url 为外部链接的记录
 * - 下载图片并上传到 CloudBase storage
 * - 更新数据库记录为 /api/images/... 格式
 *
 * 用法: node scripts/migrate-external-images.js [--dry-run]
 */

const tcb = require("@cloudbase/node-sdk");
const https = require("https");
const http = require("http");

const DRY_RUN = process.argv.includes("--dry-run");

const ENV_ID = process.env.TCB_ENV_ID || "rainbowpix-prod-d6fdzwh43bd494af";
const SECRET_ID = process.env.TCB_SECRET_ID;
const SECRET_KEY = process.env.TCB_SECRET_KEY;

if (!SECRET_ID || !SECRET_KEY) {
  console.error("请设置环境变量 TCB_SECRET_ID 和 TCB_SECRET_KEY");
  process.exit(1);
}

const app = tcb.init({
  env: ENV_ID,
  secretId: SECRET_ID,
  secretKey: SECRET_KEY,
});
const db = app.database();

// 判断是否为外部 URL（非 /api/images/ 开头且非 *.tcloudbaseapp.com）
function isExternalUrl(url) {
  if (!url) return false;
  if (url.startsWith("/api/images/")) return false;
  if (/\.tcloudbaseapp\.com/.test(url)) return false;
  if (url.startsWith("cloud://")) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

// 下载图片
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;
    const req = client.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 跟随重定向
        return downloadImage(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// 根据 URL 推断扩展名
function getExt(url, contentType) {
  if (contentType) {
    if (contentType.includes("png")) return "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
    if (contentType.includes("gif")) return "gif";
    if (contentType.includes("webp")) return "webp";
  }
  const m = url.match(/\.(png|jpe?g|gif|webp)(\?|$)/i);
  if (m) return m[1].toLowerCase();
  return "png";
}

async function main() {
  console.log("=== 迁移外部图片到 CloudBase ===");
  if (DRY_RUN) console.log("(DRY RUN 模式，不会实际修改)\n");

  // 获取所有 generations 记录
  const MAX = 1000;
  let allItems = [];
  let offset = 0;
  while (offset < MAX) {
    const res = await db
      .collection("generations")
      .where({ published: true })
      .orderBy("created_at", "desc")
      .skip(offset)
      .limit(100)
      .get();
    const items = res.data || [];
    allItems.push(...items);
    if (items.length < 100) break;
    offset += 100;
  }

  console.log(`共 ${allItems.length} 条已发布记录`);

  // 筛选外部 URL 的记录
  const externalItems = allItems.filter((item) => isExternalUrl(item.image_url));
  console.log(`其中 ${externalItems.length} 条使用外部图片 URL\n`);

  if (externalItems.length === 0) {
    console.log("无需迁移！");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const item of externalItems) {
    const url = item.image_url;
    console.log(`[${success + failed + 1}/${externalItems.length}] ${url.substring(0, 80)}...`);

    try {
      // 下载图片
      const buffer = await downloadImage(url);
      console.log(`  下载完成: ${buffer.length} bytes`);

      if (DRY_RUN) {
        console.log(`  [DRY RUN] 跳过上传`);
        success++;
        continue;
      }

      // 上传到 CloudBase
      const ext = getExt(url, null);
      const fileName = `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const cloudPath = `generated-images/${fileName}`;

      await app.uploadFile({
        cloudPath,
        fileContent: buffer,
      });

      const fileID = `cloud://rainbowpix-prod-d6fdzwh43bd494af.7261-rainbowpix-prod-d6fdzwh43bd494af-1311420730/${cloudPath}`;
      const newUrl = `/api/images/${encodeURIComponent(fileID)}`;

      // 更新数据库
      await db.collection("generations").doc(item._id).update({
        image_url: newUrl,
      });

      console.log(`  ✓ 迁移成功 → ${newUrl.substring(0, 60)}...`);
      success++;
    } catch (err) {
      console.error(`  ✗ 失败: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`成功: ${success}, 失败: ${failed}`);
}

main().catch(console.error);
