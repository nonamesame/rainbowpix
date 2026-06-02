/**
 * Seed fictional authors and reassign anonymous works.
 *
 * 1. Create 16 fictional authors in the `users` collection
 * 2. Read all generations with username="匿名用户"
 * 3. Match each prompt to a style category
 * 4. Assign each work to a random author from that category
 * 5. Update `generations` (user_id + username) and create `users` records
 */

const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: "rainbowpix-prod-d6fdzwh43bd494af",
  secretId: "AKIDqaF6mHbifQyKTP8eyIZh3EDzZAmDAxYw",
  secretKey: "EF4f3ziFYeYH0d7So4A3kEXhgXTHD3f9",
});
const db = app.database();

// ─── 16 Fictional Authors ────────────────────────────────────────────────────
// Categories: portrait, anime, landscape, fantasy, lifestyle
const AUTHORS = [
  // Portrait / Realistic (4)
  { id: "fictional_author_01", name: "Lin Qingfeng",  cat: "portrait",   bio: "专注写实人像摄影" },
  { id: "fictional_author_02", name: "Alex Chen",     cat: "portrait",   bio: "欧美风格人像创作" },
  { id: "fictional_author_03", name: "小鹿",          cat: "portrait",   bio: "日系清新写真" },
  { id: "fictional_author_04", name: "Mia",           cat: "portrait",   bio: "时尚街拍摄影师" },

  // Anime / Illustration (3)
  { id: "fictional_author_05", name: "星尘",          cat: "anime",      bio: "二次元少女画师" },
  { id: "fictional_author_06", name: "Kira",          cat: "anime",      bio: "暗黑哥特风格插画" },
  { id: "fictional_author_07", name: "阿狸",          cat: "anime",      bio: "可爱Q版角色设计" },

  // Landscape / Scene (3)
  { id: "fictional_author_08", name: "山水客",        cat: "landscape",  bio: "中国山水风景画" },
  { id: "fictional_author_09", name: "Echo",          cat: "landscape",  bio: "海洋与天空的记录者" },
  { id: "fictional_author_10", name: "Skyline",       cat: "landscape",  bio: "城市夜景与建筑" },

  // Fantasy / Creative (3)
  { id: "fictional_author_11", name: "月见",          cat: "fantasy",    bio: "东方奇幻世界" },
  { id: "fictional_author_12", name: "Nova",          cat: "fantasy",    bio: "科幻太空幻想" },
  { id: "fictional_author_13", name: "墨染",          cat: "fantasy",    bio: "水墨国风创作" },

  // Lifestyle / Animals / Food (3)
  { id: "fictional_author_14", name: "Coco",          cat: "lifestyle",  bio: "萌宠与动物世界" },
  { id: "fictional_author_15", name: "Mochi",         cat: "lifestyle",  bio: "美食与甜点艺术" },
  { id: "fictional_author_16", name: "九月",          cat: "lifestyle",  bio: "生活日常记录" },
];

// ─── Style Matching Rules ────────────────────────────────────────────────────
// Keywords → category. Order matters: first match wins.
const STYLE_RULES = [
  // Portrait keywords
  { cat: "portrait", keywords: [
    "woman", "man", "girl", "boy", "portrait", "face", "model",
    "beautiful", "handsome", "realistic", "photo", "photograph",
    "人像", "美女", "帅哥", "真人", "女生", "男生", "女孩", "男孩",
    "写真", "自拍", "模特", "时尚", "街拍", "妆容", "发型",
    "female", "male", "person", "people", "wearing", "dress",
    "smile", "eyes", "hair", "skin", "body", "figure",
    "sitting", "standing", "walking", "posing", "looking",
    "clothing", "outfit", "fashion", "style",
    "少女", "少妇", "阿姨", "御姐", "萝莉",
  ]},

  // Anime / Illustration keywords
  { cat: "anime", keywords: [
    "anime", "manga", "cartoon", "illustration", "drawing",
    "2d", "chibi", "kawaii", "waifu", "hentai",
    "二次元", "动漫", "漫画", "插画", "Q版", "卡通", "手绘",
    "少女", "男孩", "眼睛", "头发", "魔法少女",
    "pixel", "vector", "lineart", "sketch", "painting",
    "fantasy character", "elf", "angel", "demon",
    "赛璐璐", "厚涂", "平涂", "水彩画", "油画",
    "哥特", "洛丽塔", "cosplay",
  ]},

  // Landscape / Scene keywords
  { cat: "landscape", keywords: [
    "landscape", "mountain", "sea", "ocean", "sky", "cloud",
    "sunset", "sunrise", "forest", "river", "lake", "waterfall",
    "风景", "山水", "天空", "海", "山", "湖", "瀑布", "森林",
    "日落", "日出", "星空", "夜景", "城市", "建筑", "街道",
    "village", "town", "city", "building", "bridge", "road",
    "field", "meadow", "desert", "island", "beach", "coast",
    "snow", "rain", "fog", "mist", "dawn", "dusk",
    "田野", "草原", "沙漠", "岛屿", "沙滩", "海岸",
    "雪", "雨", "雾", "黄昏", "黎明",
  ]},

  // Fantasy / Creative keywords
  { cat: "fantasy", keywords: [
    "fantasy", "magic", "dragon", "phoenix", "sword",
    "dragon", "wizard", "witch", "castle", "throne",
    "奇幻", "魔法", "龙", "凤凰", "剑", "公主", "王子",
    "仙", "妖", "魔", "修仙", "玄幻", "武侠",
    "sci-fi", "space", "robot", "cyberpunk", "neon",
    "太空", "机器人", "赛博朋克", "未来", "机甲",
    "ink", "水墨", "国风", "古风", "汉服", "旗袍",
    "Chinese", "oriental", "eastern",
  ]},

  // Lifestyle / Animals / Food keywords
  { cat: "lifestyle", keywords: [
    "cat", "dog", "pet", "animal", "bird", "fish", "rabbit",
    "猫", "狗", "宠物", "动物", "鸟", "鱼", "兔子", "萌宠",
    "food", "cake", "dessert", "fruit", "coffee", "tea",
    "美食", "蛋糕", "甜点", "水果", "咖啡", "茶", "料理",
    "flower", "plant", "garden", "nature",
    "花", "植物", "花园", "盆栽",
    "home", "interior", "room", "cozy",
    "家", "室内", "房间", "温馨",
    "lifestyle", "daily", "routine", "morning",
    "生活", "日常", "早餐", "下午茶",
  ]},
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchCategory(prompt) {
  const lower = prompt.toLowerCase();
  for (const rule of STYLE_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return rule.cat;
      }
    }
  }
  // Default: pick a random category
  const cats = ["portrait", "anime", "landscape", "fantasy", "lifestyle"];
  return cats[Math.floor(Math.random() * cats.length)];
}

function pickAuthor(category) {
  const candidates = AUTHORS.filter((a) => a.cat === category);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAvatarUrl(name) {
  // Use UI Avatars service for default avatars
  const colors = [
    "e74c3c,ffffff", "3498db,ffffff", "2ecc71,ffffff",
    "9b59b6,ffffff", "f39c12,ffffff", "1abc9c,ffffff",
    "e67e22,ffffff", "34495e,ffffff", "e91e63,ffffff",
    "00bcd4,ffffff", "ff5722,ffffff", "607d8b,ffffff",
    "8bc34a,ffffff", "ff9800,ffffff", "795548,ffffff",
    "673ab7,ffffff",
  ];
  const idx = AUTHORS.findIndex((a) => a.name === name);
  const bg = colors[idx % colors.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg.split(",")[0]}&color=fff&bold=true&size=200`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Step 1: Create fictional authors in `users` collection
  console.log("=== Step 1: Creating fictional authors ===");
  for (const author of AUTHORS) {
    const avatarUrl = getAvatarUrl(author.name);
    const doc = {
      uid: author.id,
      username: author.name,
      bio: author.bio,
      avatar_url: avatarUrl,
      created_at: new Date().toISOString(),
      show_liked: false,
    };
    try {
      await db.collection("users").add(doc);
      console.log(`  ✓ Created author: ${author.name} (${author.id})`);
    } catch (err) {
      if (err.message && err.message.includes("already exists")) {
        console.log(`  - Author already exists: ${author.name}`);
      } else {
        console.error(`  ✗ Failed to create ${author.name}:`, err.message);
      }
    }
  }

  // Step 2: Fetch all anonymous generations
  console.log("\n=== Step 2: Fetching anonymous works ===");
  const BATCH_SIZE = 100;
  let allAnonymous = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await db
      .collection("generations")
      .where({ username: "匿名用户" })
      .skip(offset)
      .limit(BATCH_SIZE)
      .get();

    if (data && data.length > 0) {
      allAnonymous.push(...data);
      offset += data.length;
      hasMore = data.length === BATCH_SIZE;
      console.log(`  Fetched ${allAnonymous.length} so far...`);
    } else {
      hasMore = false;
    }
  }

  console.log(`  Total anonymous works: ${allAnonymous.length}`);

  if (allAnonymous.length === 0) {
    console.log("No anonymous works to reassign. Done!");
    return;
  }

  // Step 3: Match and assign
  console.log("\n=== Step 3: Assigning works to authors ===");
  const assignmentCounts = {};
  AUTHORS.forEach((a) => (assignmentCounts[a.id] = 0));

  // Shuffle for random distribution
  const shuffled = shuffle(allAnonymous);

  let updated = 0;
  let failed = 0;

  for (const work of shuffled) {
    const category = matchCategory(work.prompt || "");
    const author = pickAuthor(category);

    try {
      await db
        .collection("generations")
        .doc(work._id)
        .update({
          user_id: author.id,
          username: author.name,
        });
      assignmentCounts[author.id]++;
      updated++;
      if (updated % 50 === 0) {
        console.log(`  Progress: ${updated}/${shuffled.length}`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to update ${work._id}:`, err.message);
      failed++;
    }
  }

  // Step 4: Summary
  console.log("\n=== Summary ===");
  console.log(`Total works reassigned: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log("\nPer-author distribution:");
  for (const author of AUTHORS) {
    const count = assignmentCounts[author.id];
    console.log(`  ${author.name.padEnd(16)} [${author.cat.padEnd(10)}] → ${count} works`);
  }
}

main().catch(console.error);
