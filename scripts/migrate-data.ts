// @ts-nocheck
/**
 * Data migration script: Supabase -> CloudBase
 *
 * Usage:
 *   npx tsx scripts/migrate-data.ts
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for export)
 *   NEXT_PUBLIC_TCB_ENV_ID, TCB_SECRET_ID, TCB_SECRET_KEY (for import)
 */

import { createClient } from "@supabase/supabase-js";
import tcb from "@cloudbase/node-sdk";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TCB_ENV_ID = process.env.NEXT_PUBLIC_TCB_ENV_ID!;
const TCB_SECRET_ID = process.env.TCB_SECRET_ID!;
const TCB_SECRET_KEY = process.env.TCB_SECRET_KEY!;

const TABLES = ["generations", "examples", "audit_logs", "complaints"] as const;
const EXPORT_DIR = path.join(__dirname, "../migration-export");

async function exportFromSupabase() {
  console.log("=== Exporting from Supabase ===");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  for (const table of TABLES) {
    console.log(`Exporting ${table}...`);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at");

    if (error) {
      console.error(`Error exporting ${table}:`, error);
      continue;
    }

    fs.writeFileSync(
      path.join(EXPORT_DIR, `${table}.json`),
      JSON.stringify(data, null, 2)
    );
    console.log(`  Exported ${data?.length || 0} rows`);
  }

  // Export storage files
  console.log("Exporting storage files...");
  const { data: files } = await supabase.storage
    .from("generated-images")
    .list("", { limit: 1000 });

  if (files) {
    const storageDir = path.join(EXPORT_DIR, "storage");
    fs.mkdirSync(storageDir, { recursive: true });

    for (const file of files) {
      const { data: fileData } = await supabase.storage
        .from("generated-images")
        .download(file.name);

      if (fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        fs.writeFileSync(path.join(storageDir, file.name), buffer);
      }
    }
    console.log(`  Exported ${files.length} files`);
  }
}

async function importToCloudBase() {
  console.log("\n=== Importing to CloudBase ===");
  const app = tcb.init({
    env: TCB_ENV_ID,
    secretId: TCB_SECRET_ID,
    secretKey: TCB_SECRET_KEY,
  });
  const db = app.database();

  for (const table of TABLES) {
    const filePath = path.join(EXPORT_DIR, `${table}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${table} (no export file)`);
      continue;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log(`Importing ${table} (${rows.length} rows)...`);

    for (const row of rows) {
      const { _id, ...rest } = row;
      await db.collection(table).add(rest);
    }

    console.log(`  Imported ${rows.length} rows`);
  }

  // Import storage files
  const storageDir = path.join(EXPORT_DIR, "storage");
  if (fs.existsSync(storageDir)) {
    const files = fs.readdirSync(storageDir);
    console.log(`Importing ${files.length} storage files...`);

    for (const file of files) {
      const filePath = path.join(storageDir, file);
      const buffer = fs.readFileSync(filePath);
      const cloudPath = `generated-images/${file}`;

      await app.uploadFile({
        cloudPath,
        fileContent: buffer,
      });
    }

    console.log(`  Imported ${files.length} files`);
  }
}

async function main() {
  const action = process.argv[2];

  if (action === "export") {
    await exportFromSupabase();
  } else if (action === "import") {
    await importToCloudBase();
  } else {
    console.log("Usage: npx tsx scripts/migrate-data.ts [export|import]");
    console.log("  export - Export data from Supabase to local JSON files");
    console.log("  import - Import local JSON files to CloudBase");
  }
}

main().catch(console.error);
