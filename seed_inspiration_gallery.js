/**
 * Seed 50 diverse images from oblivionis.net gallery into the inspiration hall.
 * - Fetches shares from the gallery API (cached to shares_all.json)
 * - Picks 50 items with maximum tag diversity
 * - Model: gpt-image-2
 * - Author: 匿名用户
 * - Random created_at within the last 2 months
 * - Random likes_count 5-40
 */

const tcb = require("@cloudbase/node-sdk");
const https = require("https");
const fs = require("fs");
const path = require("path");

// Init TCB
const app = tcb.init({
  env: "rainbowpix-prod-d6fdzwh43bd494af",
  secretId: "AKIDqaF6mHbifQyKTP8eyIZh3EDzZAmDAxYw",
  secretKey: "EF4f3ziFYeYH0d7So4A3kEXhgXTHD3f9",
});
const db = app.database();

const ANON_USER_ID = "anonymous_seed_gallery";
const ANON_USERNAME = "匿名用户";

function randomDate(monthsBack = 2) {
  const now = Date.now();
  const minMs = now - monthsBack * 30 * 24 * 60 * 60 * 1000;
  const ts = minMs + Math.random() * (now - minMs);
  return new Date(ts).toISOString();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fetchPage(offset) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://image.oblivionis.net/api/shares?limit=50&offset=${offset}`,
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        }
      )
      .on("error", reject);
  });
}

async function fetchAllShares() {
  const cacheFile = path.join(__dirname, "shares_all.json");

  // Use cache if fresh (< 1 hour old)
  if (fs.existsSync(cacheFile)) {
    const stat = fs.statSync(cacheFile);
    if (Date.now() - stat.mtimeMs < 3600000) {
      console.log("Using cached shares_all.json");
      return JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    }
  }

  console.log("Fetching shares from gallery API...");
  const all = [];
  for (let offset = 0; offset < 500; offset += 50) {
    const page = await fetchPage(offset);
    all.push(...page);
    console.log(`  Fetched offset ${offset}: ${all.length} total`);
    if (page.length < 50) break;
  }
  fs.writeFileSync(cacheFile, JSON.stringify(all, null, 2));
  return all;
}

/**
 * Select 50 items with maximum tag diversity.
 * Strategy: pick one item per unique tag first, then fill remaining slots
 * with items that have tags not yet represented.
 */
function selectDiverse(items, count = 50) {
  // Group items by their primary tag
  const tagGroups = {};
  const noTagItems = [];

  items.forEach((item) => {
    const tags = item.tags || [];
    if (tags.length === 0) {
      noTagItems.push(item);
    } else {
      // Use the first tag as the grouping key
      const primaryTag = tags[0].name;
      if (!tagGroups[primaryTag]) tagGroups[primaryTag] = [];
      tagGroups[primaryTag].push(item);
    }
  });

  const selected = [];
  const usedIds = new Set();

  // Phase 1: Pick one from each tag group (shuffled)
  const tagNames = Object.keys(tagGroups);
  shuffleArray(tagNames);
  for (const tag of tagNames) {
    if (selected.length >= count) break;
    const group = tagGroups[tag];
    // Pick a random item from this group
    const item = group[Math.floor(Math.random() * group.length)];
    if (!usedIds.has(item.id)) {
      selected.push(item);
      usedIds.add(item.id);
    }
  }

  // Phase 2: Fill remaining slots with no-tag items or second items from tag groups
  if (selected.length < count) {
    const remaining = items.filter((i) => !usedIds.has(i.id));
    shuffleArray(remaining);
    for (const item of remaining) {
      if (selected.length >= count) break;
      selected.push(item);
      usedIds.add(item.id);
    }
  }

  return selected.slice(0, count);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

async function main() {
  const allShares = await fetchAllShares();
  console.log(`\nTotal shares available: ${allShares.length}`);

  const picked = selectDiverse(allShares, 50);
  console.log(`Selected ${picked.length} diverse items`);

  // Print tag distribution of picked items
  const tagDist = {};
  picked.forEach((item) => {
    const tags = item.tags || [];
    const tagName = tags.length > 0 ? tags[0].name : "(无标签)";
    tagDist[tagName] = (tagDist[tagName] || 0) + 1;
  });
  console.log("\nTag distribution of selected items:");
  Object.entries(tagDist)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Insert in batches of 10
  const batchSize = 10;
  let inserted = 0;

  for (let i = 0; i < picked.length; i += batchSize) {
    const batch = picked.slice(i, i + batchSize);
    const tasks = batch.map((item) => {
      const tags = (item.tags || []).map((t) => t.name);
      const doc = {
        user_id: ANON_USER_ID,
        username: ANON_USERNAME,
        prompt: item.prompt || "",
        title: item.title || "",
        model: item.params?.model || "gpt-image-2",
        image_url: item.image_url,
        reference_image_url: null,
        created_at: randomDate(2),
        published: true,
        watermark_enabled: false,
        likes_count: randomInt(5, 40),
        comments_count: 0,
        view_count: item.view_count || 0,
        source: "gallery_seed",
      };
      return db.collection("generations").add(doc);
    });

    try {
      const results = await Promise.all(tasks);
      inserted += results.length;
      console.log(
        `  Inserted batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${picked.length}`
      );
    } catch (err) {
      console.error(
        `  Batch ${Math.floor(i / batchSize) + 1} failed:`,
        err.message
      );
    }
  }

  console.log(
    `\nDone! Inserted ${inserted} entries into generations collection.`
  );
}

main().catch(console.error);
