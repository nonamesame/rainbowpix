/**
 * Seed 50 random prompt library entries into the inspiration hall.
 * - Randomly picks 50 entries from the downloaded prompt library
 * - Sets author as "匿名用户" with a fixed anonymous user_id
 * - Model: gpt-image-2
 * - Random created_at within the last 3 months
 * - Random likes_count 0-20
 * - published: true
 */

const tcb = require("@cloudbase/node-sdk");
const fs = require("fs");
const path = require("path");

// Init TCB
const app = tcb.init({
  env: "rainbowpix-prod-d6fdzwh43bd494af",
  secretId: "AKIDqaF6mHbifQyKTP8eyIZh3EDzZAmDAxYw",
  secretKey: "EF4f3ziFYeYH0d7So4A3kEXhgXTHD3f9",
});
const db = app.database();

// Fixed anonymous user_id (won't link to any real user)
const ANON_USER_ID = "anonymous_seed_000";
const ANON_USERNAME = "匿名用户";

function randomDate(monthsBack = 3) {
  const now = Date.now();
  const minMs = now - monthsBack * 30 * 24 * 60 * 60 * 1000;
  const ts = minMs + Math.random() * (now - minMs);
  return new Date(ts).toISOString();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  // Load prompt library
  const raw = fs.readFileSync(
    path.join(__dirname, "prompt_library", "prompts.json"),
    "utf-8"
  );
  const allEntries = JSON.parse(raw);

  // Filter entries that have an image_url
  const withImages = allEntries.filter((e) => e.image_url);
  console.log(`Total entries with images: ${withImages.length}`);

  // Pick 50 random ones
  const picked = shuffle(withImages).slice(0, 50);
  console.log(`Picked ${picked.length} entries for seeding`);

  // Insert in batches of 10 (TCB batch limit)
  const batchSize = 10;
  let inserted = 0;

  for (let i = 0; i < picked.length; i += batchSize) {
    const batch = picked.slice(i, i + batchSize);
    const tasks = batch.map((entry) => {
      const doc = {
        user_id: ANON_USER_ID,
        username: ANON_USERNAME,
        prompt: entry.prompt,
        title: entry.title || "",
        model: "gpt-image-2",
        image_url: entry.image_url,
        reference_image_url: "",
        created_at: randomDate(3),
        published: true,
        watermark_enabled: false,
        likes_count: randomInt(0, 20),
        comments_count: 0,
        view_count: entry.view_count || 0,
      };
      return db.collection("generations").add(doc);
    });

    try {
      const results = await Promise.all(tasks);
      inserted += results.length;
      console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${picked.length}`);
    } catch (err) {
      console.error(`  Batch ${Math.floor(i / batchSize) + 1} failed:`, err.message);
    }
  }

  console.log(`\nDone! Inserted ${inserted} entries into generations collection.`);
}

main().catch(console.error);
