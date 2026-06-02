/**
 * Seed 100 more diverse images from oblivionis.net gallery into the inspiration hall.
 * Time distribution:
 *   - 25 images: within last few days (0-5 days)
 *   - 25 images: within last 2 weeks (5-14 days)
 *   - 50 images: within last 3 months (14-90 days)
 * Random likes 5-40, author 匿名用户, model gpt-image-2
 */

const tcb = require("@cloudbase/node-sdk");
const fs = require("fs");
const path = require("path");

const app = tcb.init({
  env: "rainbowpix-prod-d6fdzwh43bd494af",
  secretId: "AKIDqaF6mHbifQyKTP8eyIZh3EDzZAmDAxYw",
  secretKey: "EF4f3ziFYeYH0d7So4A3kEXhgXTHD3f9",
});
const db = app.database();

const ANON_USER_ID = "anonymous_seed_gallery";
const ANON_USERNAME = "匿名用户";

function randomDate(minDaysBack, maxDaysBack) {
  const now = Date.now();
  const minMs = now - maxDaysBack * 24 * 60 * 60 * 1000;
  const maxMs = now - minDaysBack * 24 * 60 * 60 * 1000;
  const ts = minMs + Math.random() * (maxMs - minMs);
  return new Date(ts).toISOString();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Select items with max tag diversity, excluding already-seeded IDs.
 */
function selectDiverse(items, count, excludeIds) {
  const filtered = items.filter((i) => !excludeIds.has(i.id));

  const tagGroups = {};
  const noTagItems = [];
  filtered.forEach((item) => {
    const tags = item.tags || [];
    if (tags.length === 0) {
      noTagItems.push(item);
    } else {
      const primaryTag = tags[0].name;
      if (!tagGroups[primaryTag]) tagGroups[primaryTag] = [];
      tagGroups[primaryTag].push(item);
    }
  });

  const selected = [];
  const usedIds = new Set();

  // Phase 1: one per tag group
  const tagNames = shuffleArray(Object.keys(tagGroups));
  for (const tag of tagNames) {
    if (selected.length >= count) break;
    const item = tagGroups[tag][Math.floor(Math.random() * tagGroups[tag].length)];
    if (!usedIds.has(item.id)) {
      selected.push(item);
      usedIds.add(item.id);
    }
  }

  // Phase 2: fill with remaining
  if (selected.length < count) {
    const remaining = shuffleArray(filtered.filter((i) => !usedIds.has(i.id)));
    for (const item of remaining) {
      if (selected.length >= count) break;
      selected.push(item);
      usedIds.add(item.id);
    }
  }

  return selected.slice(0, count);
}

async function main() {
  // Load all shares
  const allShares = JSON.parse(
    fs.readFileSync(path.join(__dirname, "shares_all.json"), "utf-8")
  );
  console.log(`Total shares available: ${allShares.length}`);

  // Get existing seeded IDs to avoid duplicates
  const { data: existing } = await db
    .collection("generations")
    .where({ source: "gallery_seed" })
    .field(["image_url"])
    .get();
  const existingUrls = new Set(existing.map((e) => e.image_url));
  console.log(`Already seeded: ${existingUrls.size} entries`);

  // Filter out already-seeded items (match by image_url)
  const available = allShares.filter((s) => !existingUrls.has(s.image_url));
  console.log(`Available after dedup: ${available.length}`);

  // Select 100 diverse items
  const picked = selectDiverse(available, 100, new Set());
  console.log(`Selected ${picked.length} items`);

  // Assign time buckets
  const batch1 = picked.slice(0, 25);   // 0-5 days
  const batch2 = picked.slice(25, 50);  // 5-14 days
  const batch3 = picked.slice(50, 100); // 14-90 days

  const allItems = [
    ...batch1.map((item) => ({ item, minDays: 0, maxDays: 5 })),
    ...batch2.map((item) => ({ item, minDays: 5, maxDays: 14 })),
    ...batch3.map((item) => ({ item, minDays: 14, maxDays: 90 })),
  ];

  // Shuffle so time buckets are interleaved
  const shuffled = shuffleArray(allItems);

  // Insert in batches of 10
  const batchSize = 10;
  let inserted = 0;

  for (let i = 0; i < shuffled.length; i += batchSize) {
    const batch = shuffled.slice(i, i + batchSize);
    const tasks = batch.map(({ item, minDays, maxDays }) => {
      const doc = {
        user_id: ANON_USER_ID,
        username: ANON_USERNAME,
        prompt: item.prompt || "",
        title: item.title || "",
        model: item.params?.model || "gpt-image-2",
        image_url: item.image_url,
        reference_image_url: null,
        created_at: randomDate(minDays, maxDays),
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
      await Promise.all(tasks);
      inserted += tasks.length;
      console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${shuffled.length}`);
    } catch (err) {
      console.error(`  Batch ${Math.floor(i / batchSize) + 1} failed:`, err.message);
    }
  }

  console.log(`\nDone! Inserted ${inserted} entries.`);

  // Summary
  console.log("\nTime distribution:");
  console.log("  0-5 days: 25 entries");
  console.log("  5-14 days: 25 entries");
  console.log("  14-90 days: 50 entries");
}

main().catch(console.error);
