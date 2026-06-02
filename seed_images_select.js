/**
 * Seed selected images from images-select folder into the inspiration hall.
 * - Matches filenames to prompts.json via the ID prefix
 * - Skips entries already in the generations collection
 * - Same rules: 匿名用户, gpt-image-2, random date, random likes 0-20
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

const ANON_USER_ID = "anonymous_seed_000";
const ANON_USERNAME = "匿名用户";

function randomDate(monthsBack = 3) {
  const now = Date.now();
  const minMs = now - monthsBack * 30 * 24 * 60 * 60 * 1000;
  return new Date(minMs + Math.random() * (now - minMs)).toISOString();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  // Load prompt library
  const prompts = JSON.parse(
    fs.readFileSync(path.join(__dirname, "prompts.json"), "utf-8")
  );

  // Build lookup: short ID → prompt entry
  const promptMap = new Map();
  for (const p of prompts) {
    promptMap.set(p.id.slice(0, 8), p);
  }

  // Read selected images folder
  const imgDir = path.join(__dirname, "prompt_library", "images-select");
  const files = fs.readdirSync(imgDir).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
  console.log(`Found ${files.length} images in images-select`);

  // Extract short IDs from filenames
  const entries = [];
  for (const file of files) {
    const match = file.match(/^\d{4}_([a-f0-9]{8})/);
    if (!match) {
      console.log(`  SKIP (no ID match): ${file}`);
      continue;
    }
    const shortId = match[1];
    const prompt = promptMap.get(shortId);
    if (!prompt) {
      console.log(`  SKIP (no prompt found for ${shortId}): ${file}`);
      continue;
    }
    entries.push({ file, shortId, prompt });
  }
  console.log(`Matched ${entries.length} entries with prompts`);

  // Check which output_image_url values already exist in the database
  const BATCH = 10;
  const existingUrls = new Set();

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const queries = batch
      .filter((e) => e.prompt.output_image_url)
      .map((e) =>
        db.collection("generations").where({ image_url: e.prompt.output_image_url }).limit(1).get()
      );
    const results = await Promise.all(queries);
    results.forEach((r) => {
      if (r.data && r.data.length > 0) {
        existingUrls.add(r.data[0].image_url);
      }
    });
  }

  const fresh = entries.filter((e) => e.prompt.output_image_url && !existingUrls.has(e.prompt.output_image_url));
  console.log(`Already in DB: ${entries.length - fresh.length}, new: ${fresh.length}`);

  if (fresh.length === 0) {
    console.log("Nothing to insert.");
    return;
  }

  // Insert new entries
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += BATCH) {
    const batch = fresh.slice(i, i + BATCH);
    const tasks = batch.map((e) => {
      return db.collection("generations").add({
        user_id: ANON_USER_ID,
        username: ANON_USERNAME,
        prompt: e.prompt.prompt,
        title: e.prompt.title || "",
        model: "gpt-image-2",
        image_url: e.prompt.output_image_url,
        reference_image_url: "",
        created_at: randomDate(3),
        published: true,
        watermark_enabled: false,
        likes_count: randomInt(0, 20),
        comments_count: 0,
        view_count: e.prompt.view_count || 0,
      });
    });
    const results = await Promise.all(tasks);
    inserted += results.length;
    console.log(`  Inserted ${inserted}/${fresh.length}`);
  }

  console.log(`\nDone! Inserted ${inserted} entries.`);
}

main().catch(console.error);
