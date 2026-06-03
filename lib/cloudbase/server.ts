import tcb from "@cloudbase/node-sdk";

// 延迟初始化：避免 next build 时环境变量缺失导致构建失败
// 构建阶段只做属性访问（提取 collection/command），不调用方法
// 运行时首次调用方法时才真正初始化 tcb
let _app: any = null;

function getApp() {
  if (_app) return _app;

  // CloudBase 云函数环境中 NEXT_PUBLIC_ 前缀变量可能未注入，
  // 优先使用 TCB_ENV_ID（服务端专用），fallback 到 NEXT_PUBLIC_ 版本
  const env = process.env.TCB_ENV_ID || process.env.NEXT_PUBLIC_TCB_ENV_ID;
  if (!env) {
    throw new Error(
      "Missing TCB_ENV_ID or NEXT_PUBLIC_TCB_ENV_ID environment variable. " +
      "Please set TCB_ENV_ID in your CloudBase console environment variables."
    );
  }

  _app = tcb.init({
    env,
    secretId: process.env.TCB_SECRET_ID!,
    secretKey: process.env.TCB_SECRET_KEY!,
  });
  return _app;
}

// Proxy 延迟委托：构建时只读属性不触发 getApp()，运行时调用方法才初始化
function createLazyProxy(target: () => any) {
  return new Proxy({} as any, {
    get(_obj, prop, receiver) {
      if (prop === Symbol.toPrimitive || prop === 'inspect' || prop === 'toString') return () => '[LazyProxy]';
      const real = target();
      const value = Reflect.get(real, prop, real);
      return typeof value === 'function' ? value.bind(real) : value;
    },
  });
}

export const serverDb = createLazyProxy(() => getApp().database());
export const serverAuth = createLazyProxy(() => getApp().auth());
export default createLazyProxy(() => getApp());
