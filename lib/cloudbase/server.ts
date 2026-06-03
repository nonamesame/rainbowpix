import tcb from "@cloudbase/node-sdk";

// CloudBase 云函数环境中 NEXT_PUBLIC_ 前缀变量可能未注入，
// 优先使用 TCB_ENV_ID（服务端专用），fallback 到 NEXT_PUBLIC_ 版本
const env = process.env.TCB_ENV_ID || process.env.NEXT_PUBLIC_TCB_ENV_ID;
if (!env) {
  throw new Error(
    "Missing TCB_ENV_ID or NEXT_PUBLIC_TCB_ENV_ID environment variable. " +
    "Please set TCB_ENV_ID in your CloudBase console environment variables."
  );
}

const app = tcb.init({
  env,
  secretId: process.env.TCB_SECRET_ID!,
  secretKey: process.env.TCB_SECRET_KEY!,
});

export const serverDb = app.database();
export const serverAuth = app.auth();
export default app;
