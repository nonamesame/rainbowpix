"use client";

import cloudbase from "@cloudbase/app";
import { registerAuth } from "@cloudbase/auth";
import { registerStorage } from "@cloudbase/storage";
import { registerDatabase } from "@cloudbase/js-sdk/database";

let initialized = false;

function ensureRegistered() {
  if (initialized) return;
  initialized = true;
  try { registerAuth(cloudbase); } catch {}
  try { registerStorage(cloudbase); } catch {}
  try { registerDatabase(cloudbase); } catch {}
}

let app: ReturnType<typeof cloudbase.init> | null = null;

// 环境ID硬编码：NEXT_PUBLIC_ 变量在 CloudBase Docker 构建环境中不会注入到客户端
const TCB_ENV_ID = process.env.NEXT_PUBLIC_TCB_ENV_ID || "rainbowpix-prod-d6fdzwh43bd494af";

function getApp() {
  if (!app) {
    ensureRegistered();
    app = cloudbase.init({
      env: TCB_ENV_ID,
      region: "ap-shanghai",
    });
  }
  return app;
}

export function getAuth() {
  return getApp().auth();
}

export function getDb() {
  return getApp().database();
}

export { getApp };
