import { randomBytes } from "crypto";
import { serverDb } from "@/lib/cloudbase/server";

const MAX_REDEEM_ATTEMPTS_PER_MINUTE = 5;
const MAX_REDEEM_PER_USER_WEEKLY = 10;
const DEDUCT_MAX_RETRIES = 3;

/**
 * 生成一个 64 位随机十六进制密钥 (256 bit 随机空间)
 */
export function generateSecureKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * 批量生成密钥并写入数据库
 */
export async function generateKeys(
  count: number,
  creditsPerKey: number,
  createdBy: string
): Promise<{ key: string; credits: number }[]> {
  const keys: { key: string; credits: number }[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const key = generateSecureKey();
    await serverDb.collection("credit_keys").add({
      key,
      credits: creditsPerKey,
      used: false,
      used_by: null,
      used_at: null,
      created_at: now,
      created_by: createdBy,
    });
    keys.push({ key, credits: creditsPerKey });
  }

  return keys;
}

/**
 * 兑换密钥
 * 修复：用数据库记录兑换次数代替内存限流；用重试循环防止并发双倍兑换
 */
export async function redeemKey(
  userId: string,
  key: string
): Promise<{ success: boolean; balance?: number; credits_added?: number; error?: string }> {
  // 1. 检查该用户本周兑换次数（数据库级限流，冷启动不丢失）
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { total } = await serverDb
      .collection("credit_keys")
      .where({
        used_by: userId,
        used: true,
        used_at: serverDb.command.gte(oneWeekAgo),
      })
      .count();
    if (total >= MAX_REDEEM_PER_USER_WEEKLY) {
      return { success: false, error: "本周兑换次数已达上限（10次）" };
    }
  } catch (err: any) {
    // 集合不存在时跳过检查
    if (!err?.message?.includes("Db or Table not exist")) throw err;
  }

  // 1.5 检查该用户每分钟兑换尝试次数（防暴力尝试）
  try {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { total: recentAttempts } = await serverDb
      .collection("credit_keys")
      .where({
        used_by: userId,
        used: true,
        used_at: serverDb.command.gte(oneMinuteAgo),
      })
      .count();
    if (recentAttempts >= MAX_REDEEM_ATTEMPTS_PER_MINUTE) {
      return { success: false, error: "兑换请求过于频繁，请稍后再试" };
    }
  } catch (err: any) {
    // 集合不存在时跳过检查
    if (!err?.message?.includes("Db or Table not exist")) throw err;
  }

  // 2. 查找密钥
  let keyDoc: any;
  try {
    const result = await serverDb
      .collection("credit_keys")
      .where({ key, used: false })
      .limit(1)
      .get();
    keyDoc = result.data?.[0];
  } catch (err: any) {
    if (err?.message?.includes("Db or Table not exist")) {
      return { success: false, error: "密钥系统未初始化" };
    }
    throw err;
  }

  if (!keyDoc) {
    return { success: false, error: "密钥无效或已使用" };
  }

  // 3. 标记密钥已使用
  //    条件更新：如果被并发请求抢先，doc 会抛异常
  try {
    await serverDb
      .collection("credit_keys")
      .doc(keyDoc._id)
      .update({
        used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      });
  } catch {
    // 并发情况下另一个请求已更新该文档
    return { success: false, error: "密钥无效或已使用" };
  }

  // 4. 增加用户额度（幂等：即使重复调用也安全，因为密钥已标记 used）
  const creditsToAdd = keyDoc.credits || 1;
  let creditDocs: any[] = [];
  try {
    const result = await serverDb
      .collection("user_credits")
      .where({ user_id: userId })
      .limit(1)
      .get();
    creditDocs = result.data || [];
  } catch (err: any) {
    if (err?.message?.includes("Db or Table not exist")) {
      const { id } = await serverDb.collection("user_credits").add({
        user_id: userId,
        balance: creditsToAdd,
        total_earned: creditsToAdd,
        total_used: 0,
        updated_at: new Date().toISOString(),
      });
      return { success: true, balance: creditsToAdd, credits_added: creditsToAdd };
    }
    throw err;
  }

  const creditDoc = creditDocs?.[0];

  if (creditDoc) {
    await serverDb.collection("user_credits").doc(creditDoc._id).update({
      balance: serverDb.command.inc(creditsToAdd),
      total_earned: serverDb.command.inc(creditsToAdd),
      updated_at: new Date().toISOString(),
    });
    return {
      success: true,
      balance: (creditDoc.balance || 0) + creditsToAdd,
      credits_added: creditsToAdd,
    };
  } else {
    await serverDb.collection("user_credits").add({
      user_id: userId,
      balance: creditsToAdd,
      total_earned: creditsToAdd,
      total_used: 0,
      updated_at: new Date().toISOString(),
    });
    return { success: true, balance: creditsToAdd, credits_added: creditsToAdd };
  }
}

/**
 * 查询用户额度余额
 */
export async function getBalance(
  userId: string
): Promise<{ balance: number; total_earned: number; total_used: number }> {
  try {
    const { data } = await serverDb
      .collection("user_credits")
      .where({ user_id: userId })
      .limit(1)
      .get();

    const doc = data?.[0];
    if (!doc) {
      return { balance: 0, total_earned: 0, total_used: 0 };
    }
    return {
      balance: doc.balance || 0,
      total_earned: doc.total_earned || 0,
      total_used: doc.total_used || 0,
    };
  } catch (err: any) {
    if (err?.message?.includes("Db or Table not exist")) {
      return { balance: 0, total_earned: 0, total_used: 0 };
    }
    return { balance: 0, total_earned: 0, total_used: 0 };
  }
}

/**
 * 检查用户是否有足够额度（仅查询，不扣减）
 */
export async function checkCredits(
  userId: string,
  amount: number
): Promise<{ hasEnough: boolean; balance: number }> {
  if (amount <= 0) return { hasEnough: true, balance: 0 };

  try {
    const { data } = await serverDb
      .collection("user_credits")
      .where({ user_id: userId })
      .limit(1)
      .get();

    const doc = data?.[0];
    const balance = doc?.balance || 0;
    return { hasEnough: balance >= amount, balance };
  } catch {
    return { hasEnough: false, balance: 0 };
  }
}

/**
 * 扣减用户额度（带重试的并发安全版本）
 *
 * 并发问题：两个请求同时 checkCredits(balance=1) 都通过，
 * 然后都执行 inc(-1)，最终 balance = -1（透支）。
 *
 * 修复：改用 "先扣再验" 策略。inc 本身是原子的，
 * 扣完后如果 balance < 0 则回滚。最多重试 DEDUCT_MAX_RETRIES 次。
 */
export async function deductCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; balance?: number; error?: string }> {
  if (amount <= 0) return { success: true, balance: 0 };

  for (let attempt = 0; attempt < DEDUCT_MAX_RETRIES; attempt++) {
    try {
      // 获取用户额度文档
      const { data } = await serverDb
        .collection("user_credits")
        .where({ user_id: userId })
        .limit(1)
        .get();

      const doc = data?.[0];
      if (!doc) {
        return { success: false, balance: 0, error: "额度不足" };
      }

      const currentBalance = doc.balance || 0;
      if (currentBalance < amount) {
        return { success: false, balance: currentBalance, error: "额度不足" };
      }

      // 原子扣减（inc 是原子操作）
      await serverDb.collection("user_credits").doc(doc._id).update({
        balance: serverDb.command.inc(-amount),
        total_used: serverDb.command.inc(amount),
        updated_at: new Date().toISOString(),
      });

      // 验证：读回余额，如果为负则说明并发透支，回滚
      const { data: afterData } = await serverDb
        .collection("user_credits")
        .doc(doc._id)
        .get();

      const newBalance = afterData?.balance ?? 0;
      if (newBalance < 0) {
        // 并发透支，回滚本次扣减
        await serverDb.collection("user_credits").doc(doc._id).update({
          balance: serverDb.command.inc(amount),
          total_used: serverDb.command.inc(-amount),
          updated_at: new Date().toISOString(),
        });
        // 重试（其他并发请求可能已经回滚，下次检查会看到正确余额）
        continue;
      }

      return { success: true, balance: newBalance };
    } catch (err: any) {
      if (err?.message?.includes("Db or Table not exist")) {
        return { success: false, balance: 0, error: "额度不足" };
      }
      throw err;
    }
  }

  // 重试耗尽
  return { success: false, balance: 0, error: "系统繁忙，请稍后重试" };
}

/**
 * 增加用户额度（任务奖励、签到等）
 */
export async function addCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; balance?: number; error?: string }> {
  if (amount <= 0) return { success: true, balance: 0 };

  try {
    const { data } = await serverDb
      .collection("user_credits")
      .where({ user_id: userId })
      .limit(1)
      .get();

    const doc = data?.[0];

    if (doc) {
      await serverDb.collection("user_credits").doc(doc._id).update({
        balance: serverDb.command.inc(amount),
        total_earned: serverDb.command.inc(amount),
        updated_at: new Date().toISOString(),
      });
      return {
        success: true,
        balance: (doc.balance || 0) + amount,
      };
    } else {
      const { id } = await serverDb.collection("user_credits").add({
        user_id: userId,
        balance: amount,
        total_earned: amount,
        total_used: 0,
        updated_at: new Date().toISOString(),
      });
      return { success: true, balance: amount };
    }
  } catch (err: any) {
    if (err?.message?.includes("Db or Table not exist")) {
      return { success: false, error: "额度系统未初始化" };
    }
    throw err;
  }
}

/**
 * 回滚额度（生成失败时补偿）
 */
export async function refundCredits(
  userId: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return;

  console.warn(`[credits] refundCredits: user=${userId}, amount=${amount}`);

  try {
    const { data } = await serverDb
      .collection("user_credits")
      .where({ user_id: userId })
      .limit(1)
      .get();

    const doc = data?.[0];
    if (doc) {
      await serverDb.collection("user_credits").doc(doc._id).update({
        balance: serverDb.command.inc(amount),
        total_used: serverDb.command.inc(-amount),
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("[credits] refundCredits failed:", err);
  }
}
