import tcb from "@cloudbase/node-sdk";

const app = tcb.init({
  env: process.env.NEXT_PUBLIC_TCB_ENV_ID!,
  secretId: process.env.TCB_SECRET_ID!,
  secretKey: process.env.TCB_SECRET_KEY!,
});

export const serverDb = app.database();
export const serverAuth = app.auth();
export default app;
